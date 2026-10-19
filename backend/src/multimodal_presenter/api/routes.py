"""Endpoints de transformación y chat.

- `POST /transform` ( multipart (texto y/o archivo), respuesta única con el envelope.
- `POST /transform/stream` ) igual entrada, pero emite las secciones por SSE (Hito 5d).
- `POST /chat/stream` ( chat anclado a fuentes por SSE (Hito 6): relee el documento (cacheado)
  y responde con texto en vivo + un ancla verificada al final.
- `POST /chat/suggestions` ) preguntas sugeridas específicas a una sección (Hito 6).
"""

import json
import secrets

import logfire
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from pydantic_ai.models import Model

from ..config import Settings, get_settings
from ..model_provider import build_model, build_perception_model, build_summary_model
from ..pipeline import transform
from ..pipeline.chat import chat_stream, generate_suggestions
from ..pipeline.deck import generate_deck
from ..pipeline.extraction import prepare_input
from ..pipeline.illustration import has_image_provider, illustrate
from ..pipeline.image_explanation import explain_image
from ..pipeline.narration import narrate
from ..pipeline.pdf_locator import render_pagina
from ..pipeline.perception import is_audio
from ..pipeline.streaming import transform_stream
from ..pipeline.summary import summarize
from ..pipeline.transcribe import transcribe_audio
from ..pipeline.uploads import read_and_validate_upload
from ..schemas.audio import AudioEvidence
from ..schemas.chat import ChatStreamError, ChatTurn, SuggestionsResponse
from ..schemas.presentation import Section
from ..schemas.telemetry import TelemetryBatch
from ..schemas.transform import (
    GeneratedDeck,
    IllustrationItem,
    IllustrationsRequest,
    IllustrationsResponse,
    ImageExplanationResponse,
    NarrationRequest,
    StreamError,
    SummaryResponse,
    TranscriptionResponse,
    TransformResponse,
)
from ..telemetry import record_ux_event, resolve_telemetry_dir
from .auth import usuario_opcional
from .limites import VENTANA_GASTO_S, Ventana, exige_cupo, ip_del_cliente

router = APIRouter(tags=["pipeline"])

MAX_CHAT_HISTORY = 12  # se acotan los turnos que viajan al modelo (prompt bounded)


#: Contador de lo que cuesta dinero. Las dos categorías comparten ventana (una hora) y se
#: diferencian en el prefijo de la llave y en el tope, que viene de los ajustes.
_gasto = Ventana(VENTANA_GASTO_S)


def _cupo(categoria: str, atributo: str, mensaje: str):
    """Construye la dependencia que corta antes de gastar.

    Va como dependencia y no dentro del endpoint a propósito: FastAPI las resuelve ANTES de entrar
    al cuerpo, así que un 429 no llega a tocar el modelo. Si estuviera dentro, el tope ya habría
    costado lo que pretende evitar.

    Se marca aunque la petición acabe en un 400: lo que se limita es el gasto POTENCIAL por
    dirección, y distinguir cuáles llegaron al modelo obligaría a contar después de responder, que
    es justo cuando ya no sirve.
    """

    async def comprueba(request: Request, settings: Settings = Depends(get_settings)) -> None:
        llave = f"{categoria}:{ip_del_cliente(request, settings.proxies_confiables)}"
        exige_cupo(_gasto.espera(llave, getattr(settings, atributo)), mensaje)
        _gasto.marca(llave)

    return comprueba


#: Lo caro: transformar un documento son unas décimas de dólar, y el deck y las ilustraciones
#: generan imágenes. Un participante hace una transformación, quizá dos.
cupo_de_generacion = _cupo(
    "gen",
    "limite_generacion_por_hora",
    "Se alcanzó el límite de documentos por hora.",
)
#: Lo barato pero no gratis: cada turno de chat, cada tanda de sugeridas y cada adelanto son una
#: llamada al modelo. Una sesión de evaluación hace del orden de treinta o cuarenta.
cupo_de_conversacion = _cupo(
    "conv",
    "limite_conversacion_por_hora",
    "Se alcanzó el límite de preguntas por hora.",
)


def get_model(settings: Settings = Depends(get_settings)) -> Model:
    """Provee el modelo (Anthropic + fallback Gemini directo). Sobreescribible en tests."""
    return build_model(settings)


def get_summary_model(settings: Settings = Depends(get_settings)) -> Model:
    """Provee el modelo liviano (Haiku) del adelanto inicial. Sobreescribible en tests."""
    return build_summary_model(settings)


def get_perception_model(settings: Settings = Depends(get_settings)) -> Model | None:
    """Provee el modelo de la Fase 0 (percepción de audio). Sobreescribible en tests.

    Devuelve None si no hay proveedor configurado, en vez de lanzar: así subir texto, PDF o
    imagen sigue funcionando sin ninguna clave de Gemini (la Fase 0 no se ejecuta para esas
    fuentes). El 503 se emite solo cuando alguien sube AUDIO sin proveedor, ver `_need_audio`.
    """
    try:
        return build_perception_model(settings)
    except RuntimeError:
        return None


def _need_audio_provider(media_type: str | None, model: Model | None) -> None:
    """503 claro si se subió audio y no hay modelo de percepción configurado."""
    if is_audio(media_type) and model is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "La entrada de audio necesita un modelo con entrada acústica nativa, que no "
                "está configurado. Define GOOGLE_API_KEY en el backend. El texto, el PDF y "
                "la imagen funcionan sin esa clave."
            ),
        )


def _parse_audio_evidence(
    media_type: str | None, evidence: str | None, feature: str
) -> AudioEvidence | None:
    """Evidencia acústica reenviada por el frontend, para las funciones que RELEEN la fuente.

    El chat, las preguntas sugeridas y el deck vuelven a pasar el documento al motor de
    estructuración, que no admite audio. En vez de re-percibir el audio en cada petición (que
    costaría de más y, peor, haría que el "documento" cambiara entre turnos porque la percepción
    es probabilística) el frontend **reenvía la MISMA evidencia** que produjo la Fase 0 durante
    la transformación. Así el documento es idéntico en todos los turnos y no se paga dos veces.

    Devuelve None para texto, PDF e imagen: esas rutas no cambian en absoluto.
    """
    if not is_audio(media_type):
        return None
    if not evidence:
        raise HTTPException(
            status_code=415,
            detail=(
                f"{feature} sobre un audio necesita la evidencia acústica de la transformación. "
                "Transforma el audio primero; el sistema la reenvía automáticamente."
            ),
        )
    try:
        return AudioEvidence.model_validate_json(evidence)
    except ValidationError as exc:
        # Viene del cliente: se valida igual que cualquier otra entrada, no se confía.
        raise HTTPException(
            status_code=422, detail="La evidencia acústica enviada no es válida."
        ) from exc


async def parse_document_inputs(
    text: str | None,
    file: UploadFile | None,
    settings: Settings,
    document_id: str | None = None,
    usuario: object | None = None,
) -> tuple[str | None, bytes | None, str | None, str | None]:
    """Valida la entrada (al menos una; tipo/tamaño del archivo). Lanza HTTPException.

    Pública porque es el ÚNICO sitio por el que entra un documento al sistema: los ocho endpoints
    que reciben uno pasan por aquí. Eso es lo que permite que una presentación guardada siga
    sirviendo (chat, deck, panel de fuente) tocando una función en lugar de ocho.

    Tres formas de traer el documento, por orden: el archivo subido, el texto pegado, o un
    `document_id` del almacén. La tercera es la que hace falta cuando alguien abre una
    presentación guardada desde otro navegador, donde ya no existe el `File` original.

    **El `document_id` exige cuenta Y propiedad.** Sin esa comprobación bastaría conocer un id
    (que es un hash del contenido, pero aun así) para leer el documento de otra persona.
    """
    text_value = text.strip() if text else None
    has_file = file is not None and file.filename

    if not text_value and not has_file and document_id:
        return await _documento_del_almacen(document_id, usuario, settings)

    if not text_value and not has_file:
        raise HTTPException(status_code=400, detail="Debes enviar texto, un archivo, o ambos.")

    binary: bytes | None = None
    media_type: str | None = None
    filename: str | None = None
    if has_file:
        assert file is not None
        max_bytes = settings.max_upload_mb * 1024 * 1024
        binary, media_type = await read_and_validate_upload(
            file, max_bytes, max_audio_seconds=settings.max_audio_minutes * 60
        )
        filename = file.filename
    return text_value, binary, media_type, filename


async def _documento_del_almacen(
    document_id: str, usuario: object | None, settings: Settings
) -> tuple[str | None, bytes | None, str | None, str | None]:
    """Carga un documento guardado, comprobando antes que quien lo pide es su dueño."""
    from ..storage import conectar
    from ..storage import documents as almacen
    from ..storage import presentations as repo

    if usuario is None:
        raise HTTPException(status_code=401, detail="Necesitas iniciar sesión para usar esto.")

    async with conectar(settings) as conn:
        if not await repo.tiene_documento(conn, usuario["id"], document_id):
            # 404 y no 403: decir "existe pero no es tuyo" ya es contar algo.
            raise HTTPException(status_code=404, detail="No se encontró ese documento.")
        fila = await almacen.metadatos(conn, document_id)

    contenido = await almacen.leer(settings, document_id)
    if fila is None or contenido is None:
        raise HTTPException(status_code=404, detail="No se encontró ese documento.")

    if fila["source_kind"] == "text":
        # Las fuentes de texto se guardan como bytes igual que las demás, pero el pipeline las
        # espera como texto: se devuelven por el carril que les corresponde.
        return contenido.decode("utf-8"), None, None, None
    return None, contenido, fila["media_type"], fila["nombre_archivo"]


@router.post(
    "/transform",
    response_model=TransformResponse,
    dependencies=[Depends(cupo_de_generacion)],
)
async def transform_endpoint(
    response: Response,
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    model: Model = Depends(get_model),
    perception_model: Model | None = Depends(get_perception_model),
    settings: Settings = Depends(get_settings),
) -> TransformResponse:
    """Recibe texto y/o un archivo y devuelve la presentación + el reporte de grounding.

    Si el archivo es audio, pasa primero por la Fase 0 (percepción) y lo que entra al
    pipeline de estructuración es la `AudioEvidence`. Para texto/PDF/imagen no cambia nada.
    """
    text_value, binary, media_type, filename = await parse_document_inputs(
        text, file, settings, document_id, usuario
    )
    _need_audio_provider(media_type, perception_model)

    result = await transform(
        model,
        text=text_value,
        binary=binary,
        media_type=media_type,
        filename=filename,
        semantic_enabled=settings.semantic_verification_enabled,
        perception_model=perception_model,
    )

    response.headers["X-Grounding-Warnings"] = str(result.grounding.not_found_sections)
    return TransformResponse(
        presentation=result.presentation,
        grounding=result.grounding,
        semantic=result.semantic,
        chart_notes=result.chart_notes,
        transcript=result.transcript,
        audio_evidence=result.audio_evidence,
    )


@router.post(
    "/transform/stream",
    dependencies=[Depends(cupo_de_generacion)],
)
async def transform_stream_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    model: Model = Depends(get_model),
    perception_model: Model | None = Depends(get_perception_model),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Igual que /transform pero emite las secciones por Server-Sent Events (SSE).

    La validación de entrada (400/413/415) ocurre ANTES del stream (respuesta HTTP normal).
    Un fallo del modelo a mitad del stream se emite como evento `error` (no una presentación
    silenciosamente incompleta).
    """
    text_value, binary, media_type, filename = await parse_document_inputs(
        text, file, settings, document_id, usuario
    )
    _need_audio_provider(media_type, perception_model)

    async def event_source():
        try:
            async for event in transform_stream(
                model,
                text=text_value,
                binary=binary,
                media_type=media_type,
                filename=filename,
                semantic_enabled=settings.semantic_verification_enabled,
                perception_model=perception_model,
            ):
                yield f"data: {event.model_dump_json()}\n\n"
        except Exception:
            # El participante ve una frase corta; el registro se queda con la causa. Sin esta
            # línea el fallo era indiagnosticable: la respuesta ya iba por el stream, así que
            # uvicorn registraba «200 OK», el navegador enseñaba «se interrumpió» y en los
            # registros del servidor no quedaba absolutamente nada que mirar. Pasó en producción.
            logfire.exception("transformación: el stream murió a mitad")
            err = StreamError(message="La generación se interrumpió.")
            yield f"data: {err.model_dump_json()}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")


def _parse_history(raw: str) -> list[ChatTurn]:
    """Parsea el historial (JSON del frontend) y acota a los últimos turnos."""
    try:
        data = json.loads(raw or "[]")
        turns = [ChatTurn.model_validate(item) for item in data]
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Historial de chat inválido.") from exc
    return turns[-MAX_CHAT_HISTORY:]


@router.post(
    "/chat/stream",
    dependencies=[Depends(cupo_de_conversacion)],
)
async def chat_stream_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    question: str = Form(),
    history: str = Form(default="[]"),
    audio_evidence: str | None = Form(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Chat anclado a fuentes (SSE). Relee el documento (cacheado) y responde ese turno.

    El texto se emite en vivo; el ancla verificada y los componentes interactivos van en el
    evento final `done`. Un fallo se emite como `error` (nunca una respuesta a medias 'lista').
    """
    text_value, binary, media_type, filename = await parse_document_inputs(
        text, file, settings, document_id, usuario
    )
    question_value = question.strip()
    if not question_value:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")
    turns = _parse_history(history)
    evidencia = _parse_audio_evidence(media_type, audio_evidence, "El chat")
    extraction = prepare_input(
        text=text_value,
        binary=binary,
        media_type=media_type,
        filename=filename,
        audio_evidence=evidencia,
    )

    async def event_source():
        try:
            async for event in chat_stream(
                model, extraction=extraction, history=turns, question=question_value
            ):
                yield f"data: {event.model_dump_json()}\n\n"
        except Exception:
            # Igual que en la transformación: la causa va al registro, no al participante.
            # La longitud de la pregunta sí, el texto no, la telemetría del Hito 8 no manda
            # contenido y este registro no va a ser la puerta de atrás por la que se cuele.
            logfire.exception(
                "chat: el stream murió a mitad (pregunta de {n} caracteres)",
                n=len(question_value),
            )
            err = ChatStreamError(message="La generación se interrumpió.")
            yield f"data: {err.model_dump_json()}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")


@router.post(
    "/chat/suggestions",
    response_model=SuggestionsResponse,
    dependencies=[Depends(cupo_de_conversacion)],
)
async def chat_suggestions_endpoint(
    section: str = Form(),
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    audio_evidence: str | None = Form(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> SuggestionsResponse:
    """Preguntas sugeridas específicas a una sección (Punto 9). Relee el documento (cacheado)."""
    text_value, binary, media_type, filename = await parse_document_inputs(
        text, file, settings, document_id, usuario
    )
    evidencia = _parse_audio_evidence(media_type, audio_evidence, "Las preguntas sugeridas")
    try:
        section_obj = Section.model_validate_json(section)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Sección inválida.") from exc
    extraction = prepare_input(
        text=text_value,
        binary=binary,
        media_type=media_type,
        filename=filename,
        audio_evidence=evidencia,
    )
    questions = await generate_suggestions(model, extraction=extraction, section=section_obj)
    return SuggestionsResponse(questions=questions)


@router.post(
    "/summary",
    response_model=SummaryResponse,
    dependencies=[Depends(cupo_de_conversacion)],
)
async def summary_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    model: Model = Depends(get_summary_model),
    settings: Settings = Depends(get_settings),
) -> SummaryResponse:
    """Adelanto corto del contenido (Hito 5g), con un modelo liviano (Haiku).

    El frontend lo pide EN PARALELO a /transform/stream: da un preview de qué trata lo subido
    mientras el pipeline completo (Sonnet) trabaja. Es un extra no crítico; si falla, el frontend
    lo muestra como tal y la transformación sigue su curso.
    """
    text_value, binary, media_type, filename = await parse_document_inputs(
        text, file, settings, document_id, usuario
    )
    if is_audio(media_type):
        raise HTTPException(
            status_code=415,
            detail=(
                "El adelanto de un audio se genera desde su transcripción, no desde el "
                "archivo: el modelo del adelanto no admite audio. El frontend lo hace solo."
            ),
        )
    extraction = prepare_input(
        text=text_value, binary=binary, media_type=media_type, filename=filename
    )
    summary = await summarize(model, extraction=extraction)
    return SummaryResponse(summary=summary)


@router.post(
    "/narration",
    responses={200: {"content": {"audio/mpeg": {}}}},
    response_class=Response,
    dependencies=[Depends(cupo_de_generacion)],
)
async def narration_endpoint(
    req: NarrationRequest,
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Narración tipo audiolibro (Hito 5g Parte 3). Devuelve mp3 (audio/mpeg).

    On-demand y cacheada por documento: pedir la misma narración otra vez usa la caché (no
    regenera guion ni audio). Si el TTS no está configurado o falla, responde con error visible
    (503/502) para que el frontend lo muestre, nunca un reproductor mudo sin explicación.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="La narración por voz no está configurada.")
    try:
        audio = await narrate(model, req.presentation, settings)
    except Exception as exc:  # fallo del proveedor TTS / red → error visible, no silencio
        # `from exc` encadena la causa en el traceback, pero FastAPI atiende la HTTPException y
        # ese traceback no llega a ninguna parte. Sin esta línea, «no se pudo generar la
        # narración» es todo lo que existe, aquí y en los registros.
        logfire.exception("narración: el proveedor de voz falló")
        raise HTTPException(status_code=502, detail="No se pudo generar la narración.") from exc
    return Response(content=audio, media_type="audio/mpeg")


@router.post(
    "/pdf-page",
    responses={200: {"content": {"image/png": {}}}},
    response_class=Response,
)
async def pdf_page_endpoint(
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    page: int = Form(...),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Dibuja UNA página del PDF como PNG, para el visor con resaltado de región.

    La dibuja el MISMO motor que calculó las regiones. Esa es la razón de renderizar aquí en vez
    de en el navegador: con un motor que dibuja y otro que mide, cualquier desacuerdo sobre el
    recorte o la rotación de la página saldría como un recuadro descuadrado, y el recuadro es lo
    único que esta pieza promete.

    El archivo viaja en la petición, como en el chat, el deck y la narración: el backend no
    guarda documentos. El frontend memoriza la imagen por página, así que abrir y cerrar la misma
    fuente no vuelve a subir nada.
    """
    _text, binary, media_type, _filename = await parse_document_inputs(
        None, file, settings, document_id, usuario
    )
    if binary is None or media_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Se requiere un archivo PDF.")
    if page < 1:
        raise HTTPException(status_code=400, detail="La página debe ser 1 o mayor.")
    try:
        imagen = render_pagina(binary, page)
    except IndexError as exc:
        raise HTTPException(
            status_code=404, detail="Esa página no existe en el documento."
        ) from exc
    except Exception as exc:  # noqa: BLE001 (un PDF que no se puede dibujar es error visible)
        raise HTTPException(status_code=502, detail="No se pudo dibujar la página.") from exc
    # Inmutable: la misma página del mismo PDF siempre da la misma imagen.
    return Response(
        content=imagen,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600, immutable"},
    )


@router.post(
    "/explain-image",
    response_model=ImageExplanationResponse,
    dependencies=[Depends(cupo_de_conversacion)],
)
async def explain_image_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    page: int | None = Form(default=None),
    context: str | None = Form(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> ImageExplanationResponse:
    """Explica bajo demanda una imagen REAL del documento (Hito 5h Parte 3, extensión de 4+6).

    Solo para fuentes binarias (PDF/imagen): el modelo relee el binario nativo y explica la imagen
    en lenguaje accesible. La atribución es la propia imagen (se muestra junto a ella en el
    `SourcePanel`). En fuentes de texto o de audio no hay imagen real que explicar → 400.
    """
    text_value, binary, media_type, filename = await parse_document_inputs(
        text, file, settings, document_id, usuario
    )
    if is_audio(media_type):
        raise HTTPException(status_code=400, detail="Un audio no tiene imagen que explicar.")
    extraction = prepare_input(
        text=text_value, binary=binary, media_type=media_type, filename=filename
    )
    if extraction.source_kind == "text":
        raise HTTPException(
            status_code=400, detail="Una fuente de texto no tiene imagen que explicar."
        )
    explanation = await explain_image(model, extraction, page=page, context=context)
    return ImageExplanationResponse(explanation=explanation)


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    dependencies=[Depends(cupo_de_conversacion)],
)
async def transcribe_endpoint(
    file: UploadFile = File(),
    settings: Settings = Depends(get_settings),
) -> TranscriptionResponse:
    """Transcribe una pregunta hablada a texto (entrada por voz del chat).

    Solo audio→texto; el usuario revisa y envía manualmente (nunca se envía ni se interpreta como
    comando). `503` si falta la clave de OpenAI, `502` si falla el proveedor, falla visible.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="La transcripción de voz no está configurada.")
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Audio vacío.")
    if len(audio) > 25 * 1024 * 1024:  # límite de OpenAI; una pregunta hablada es muchísimo menor
        raise HTTPException(status_code=413, detail="El audio es demasiado largo.")
    try:
        text = await transcribe_audio(settings, audio, file.filename or "audio.webm")
    except Exception as exc:  # error del proveedor / red → visible, no silencio
        raise HTTPException(status_code=502, detail="No se pudo transcribir el audio.") from exc
    return TranscriptionResponse(text=text)


@router.post(
    "/deck",
    response_model=GeneratedDeck,
    dependencies=[Depends(cupo_de_generacion)],
)
async def deck_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    document_id: str | None = Form(default=None),
    usuario: object | None = Depends(usuario_opcional),
    audio_evidence: str | None = Form(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> GeneratedDeck:
    """Presentación en diapositivas GENERADA (guion propio, desde la fuente). On-demand.

    Relee el documento original (como el chat) y sintetiza un deck pensado para slides. Distinto de
    la vista de slides del 5h (re-composición sin generación). Si no hay clave de OpenAI, el deck se
    genera igual pero sin imágenes de apoyo (degradación honesta, no falla).
    """
    text_value, binary, media_type, filename = await parse_document_inputs(
        text, file, settings, document_id, usuario
    )
    evidencia = _parse_audio_evidence(media_type, audio_evidence, "La presentación")
    extraction = prepare_input(
        text=text_value,
        binary=binary,
        media_type=media_type,
        filename=filename,
        audio_evidence=evidencia,
    )
    return await generate_deck(model, settings, extraction)


@router.post(
    "/illustrations",
    response_model=IllustrationsResponse,
    dependencies=[Depends(cupo_de_generacion)],
)
async def illustrations_endpoint(
    req: IllustrationsRequest,
    model: Model = Depends(get_summary_model),
    settings: Settings = Depends(get_settings),
) -> IllustrationsResponse:
    """Ilustraciones de apoyo generadas (Hito 5h Parte 1). On-demand tras la transformación.

    El frontend solo lo llama para documentos de fuente TEXTO (condición 1: un texto no trae
    imágenes). Clasifica los núcleos (Haiku) y genera imagen (Ideogram primario, gpt-image-1 de
    fallback) solo para los que califican, hasta un techo de seguridad. Cacheado por documento.
    `503` si no hay proveedor de imagen; si falla la generación, `502` (falla visible; el frontend
    simplemente no muestra ilustración).
    """
    if not has_image_provider(settings):
        raise HTTPException(
            status_code=503, detail="Las ilustraciones generadas no están configuradas."
        )
    try:
        pairs = await illustrate(model, settings, req.presentation)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail="No se pudieron generar las ilustraciones."
        ) from exc
    return IllustrationsResponse(
        illustrations=[IllustrationItem(section_id=sid, illustration=ill) for sid, ill in pairs]
    )


@router.post("/telemetry", status_code=204)
async def telemetry_endpoint(
    batch: TelemetryBatch,
    settings: Settings = Depends(get_settings),
) -> Response:
    """Ingesta de telemetría de comportamiento (Hito 8, capa observacional).

    Recibe un lote de eventos por JSON (el frontend agrupa y usa `sendBeacon`). El schema es
    aparte del contrato de datos y corta strings largos: nunca entra contenido del documento ni
    texto de preguntas. Cada evento va a Logfire (ux=true) y al JSONL del día. Responde 204: es
    telemetría, el frontend no espera cuerpo y no debe bloquearse por ella.
    """
    jsonl_dir = resolve_telemetry_dir(settings)
    eventos, descartados = batch.valid_events()
    if descartados:
        # Se traza y se sigue: antes un evento malo invalidaba el lote entero y se perdían los
        # buenos que venían con él (ver `TelemetryBatch`). Perder un evento es aceptable; perder
        # 50 de una sesión irrepetible, no.
        logfire.warn(
            "telemetría: {descartados} de {total} eventos descartados por el schema",
            descartados=descartados,
            total=len(batch.events),
        )
    for event in eventos:
        record_ux_event(event, jsonl_dir=jsonl_dir)
    return Response(status_code=204)


@router.get("/telemetry/volcado")
async def telemetry_volcado_endpoint(
    x_telemetria_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Devuelve los JSONL de telemetría, concatenados, para bajarlos desde el despliegue.

    **Por qué existe.** Los eventos se escriben en un volumen al que no se llega sin la CLI de la
    plataforma, y durante las sesiones hay que mirarlos el mismo día: una sesión que salió rara se
    diagnostica con los datos delante, no la semana siguiente. Esto es el camino corto.

    **Por qué devuelve el crudo y no los CSV.** El exportador que produce los agregados ya existe,
    está probado y es el que se usó con los datos de desarrollo. Reimplementarlo aquí sería tener
    dos verdades sobre qué significa cada columna; se baja el crudo y se corre el de siempre
    (`scripts/bajar_telemetria.py` hace las dos cosas de un tirón).

    **Qué sale por aquí.** Metadatos anónimos: el schema de entrada ya rechaza cualquier cadena de
    más de 40 caracteres, así que no hay contenido de documentos ni texto de preguntas. El
    participante es `Pxx`, que es el seudónimo que promete el consentimiento. Aun así va detrás de
    un token, porque son los datos de un experimento con personas.

    Sin `TELEMETRIA_TOKEN` configurado esto **no existe**: 404, como cualquier ruta inventada. Una
    puerta que anuncia que está cerrada es una invitación a probar la llave.
    """
    esperado = settings.telemetria_token
    if not esperado:
        raise HTTPException(status_code=404, detail="No encontrado.")

    # En tiempo constante y sobre bytes: comparar cadenas con `==` filtra por cuánto tardan en
    # diferir, y `compare_digest` sobre str exige ASCII y lanza si llega otra cosa.
    recibido = (x_telemetria_token or "").encode("utf-8")
    if not secrets.compare_digest(recibido, esperado.encode("utf-8")):
        # 401 y no 404 porque para llegar hasta aquí ya hubo que pasar el portón: a estas alturas
        # esconder el endpoint no gana nada y sí cuesta media hora de depuración el día que el
        # token esté mal escrito.
        raise HTTPException(status_code=401, detail="Token de telemetría incorrecto.")

    carpeta = resolve_telemetry_dir(settings)
    if carpeta is None or not carpeta.exists():
        raise HTTPException(status_code=404, detail="No hay telemetría escrita todavía.")

    archivos = sorted(carpeta.glob("ux-*.jsonl"))

    def lineas():
        """Se emite por trozos y no de una: son archivos de un volumen que crecen con cada sesión,
        y leerlos enteros en memoria para mandarlos es gasto sin motivo."""
        for archivo in archivos:
            with archivo.open("rb") as handle:
                while trozo := handle.read(64 * 1024):
                    yield trozo

    logfire.info("telemetría: volcado servido ({n} archivos)", n=len(archivos))
    return StreamingResponse(
        lineas(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": 'attachment; filename="telemetria.jsonl"'},
    )
