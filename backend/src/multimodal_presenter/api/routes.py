"""Endpoints de transformación y chat.

- `POST /transform` — multipart (texto y/o archivo), respuesta única con el envelope.
- `POST /transform/stream` — igual entrada, pero emite las secciones por SSE (Hito 5d).
- `POST /chat/stream` — chat anclado a fuentes por SSE (Hito 6): relee el documento (cacheado)
  y responde con texto en vivo + un ancla verificada al final.
- `POST /chat/suggestions` — preguntas sugeridas específicas a una sección (Hito 6).
"""

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from pydantic_ai.models import Model

from ..config import Settings, get_settings
from ..model_provider import build_model, build_summary_model
from ..pipeline import transform
from ..pipeline.chat import chat_stream, generate_suggestions
from ..pipeline.deck import generate_deck
from ..pipeline.extraction import prepare_input
from ..pipeline.illustration import has_image_provider, illustrate
from ..pipeline.image_explanation import explain_image
from ..pipeline.narration import narrate
from ..pipeline.streaming import transform_stream
from ..pipeline.summary import summarize
from ..pipeline.transcribe import transcribe_audio
from ..pipeline.uploads import read_and_validate_upload
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

router = APIRouter(tags=["pipeline"])

MAX_CHAT_HISTORY = 12  # se acotan los turnos que viajan al modelo (prompt bounded)


def get_model(settings: Settings = Depends(get_settings)) -> Model:
    """Provee el modelo (Anthropic + fallback OpenRouter). Sobreescribible en tests."""
    return build_model(settings)


def get_summary_model(settings: Settings = Depends(get_settings)) -> Model:
    """Provee el modelo liviano (Haiku) del adelanto inicial. Sobreescribible en tests."""
    return build_summary_model(settings)


async def _parse_inputs(
    text: str | None, file: UploadFile | None, settings: Settings
) -> tuple[str | None, bytes | None, str | None, str | None]:
    """Valida la entrada (al menos uno; tipo/tamaño del archivo). Lanza HTTPException."""
    text_value = text.strip() if text else None
    has_file = file is not None and file.filename
    if not text_value and not has_file:
        raise HTTPException(status_code=400, detail="Debes enviar texto, un archivo, o ambos.")

    binary: bytes | None = None
    media_type: str | None = None
    filename: str | None = None
    if has_file:
        assert file is not None
        max_bytes = settings.max_upload_mb * 1024 * 1024
        binary, media_type = await read_and_validate_upload(file, max_bytes)
        filename = file.filename
    return text_value, binary, media_type, filename


@router.post("/transform", response_model=TransformResponse)
async def transform_endpoint(
    response: Response,
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> TransformResponse:
    """Recibe texto y/o un archivo y devuelve la presentación + el reporte de grounding."""
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)

    result = await transform(
        model,
        text=text_value,
        binary=binary,
        media_type=media_type,
        filename=filename,
        semantic_enabled=settings.semantic_verification_enabled,
    )

    response.headers["X-Grounding-Warnings"] = str(result.grounding.not_found_sections)
    return TransformResponse(
        presentation=result.presentation,
        grounding=result.grounding,
        semantic=result.semantic,
        chart_notes=result.chart_notes,
    )


@router.post("/transform/stream")
async def transform_stream_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Igual que /transform pero emite las secciones por Server-Sent Events (SSE).

    La validación de entrada (400/413/415) ocurre ANTES del stream (respuesta HTTP normal).
    Un fallo del modelo a mitad del stream se emite como evento `error` (no una presentación
    silenciosamente incompleta).
    """
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)

    async def event_source():
        try:
            async for event in transform_stream(
                model,
                text=text_value,
                binary=binary,
                media_type=media_type,
                filename=filename,
                semantic_enabled=settings.semantic_verification_enabled,
            ):
                yield f"data: {event.model_dump_json()}\n\n"
        except Exception:
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


@router.post("/chat/stream")
async def chat_stream_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    question: str = Form(),
    history: str = Form(default="[]"),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    """Chat anclado a fuentes (SSE). Relee el documento (cacheado) y responde ese turno.

    El texto se emite en vivo; el ancla verificada y los componentes interactivos van en el
    evento final `done`. Un fallo se emite como `error` (nunca una respuesta a medias 'lista').
    """
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)
    question_value = question.strip()
    if not question_value:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")
    turns = _parse_history(history)
    extraction = prepare_input(
        text=text_value, binary=binary, media_type=media_type, filename=filename
    )

    async def event_source():
        try:
            async for event in chat_stream(
                model, extraction=extraction, history=turns, question=question_value
            ):
                yield f"data: {event.model_dump_json()}\n\n"
        except Exception:
            err = ChatStreamError(message="La generación se interrumpió.")
            yield f"data: {err.model_dump_json()}\n\n"

    return StreamingResponse(event_source(), media_type="text/event-stream")


@router.post("/chat/suggestions", response_model=SuggestionsResponse)
async def chat_suggestions_endpoint(
    section: str = Form(),
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> SuggestionsResponse:
    """Preguntas sugeridas específicas a una sección (Punto 9). Relee el documento (cacheado)."""
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)
    try:
        section_obj = Section.model_validate_json(section)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail="Sección inválida.") from exc
    extraction = prepare_input(
        text=text_value, binary=binary, media_type=media_type, filename=filename
    )
    questions = await generate_suggestions(model, extraction=extraction, section=section_obj)
    return SuggestionsResponse(questions=questions)


@router.post("/summary", response_model=SummaryResponse)
async def summary_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_summary_model),
    settings: Settings = Depends(get_settings),
) -> SummaryResponse:
    """Adelanto corto del contenido (Hito 5g), con un modelo liviano (Haiku).

    El frontend lo pide EN PARALELO a /transform/stream: da un preview de qué trata lo subido
    mientras el pipeline completo (Sonnet) trabaja. Es un extra no crítico; si falla, el frontend
    lo muestra como tal y la transformación sigue su curso.
    """
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)
    extraction = prepare_input(
        text=text_value, binary=binary, media_type=media_type, filename=filename
    )
    summary = await summarize(model, extraction=extraction)
    return SummaryResponse(summary=summary)


@router.post(
    "/narration",
    responses={200: {"content": {"audio/mpeg": {}}}},
    response_class=Response,
)
async def narration_endpoint(
    req: NarrationRequest,
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Narración tipo audiolibro (Hito 5g Parte 3). Devuelve mp3 (audio/mpeg).

    On-demand y cacheada por documento: pedir la misma narración otra vez usa la caché (no
    regenera guion ni audio). Si el TTS no está configurado o falla, responde con error visible
    (503/502) para que el frontend lo muestre — nunca un reproductor mudo sin explicación.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="La narración por voz no está configurada.")
    try:
        audio = await narrate(model, req.presentation, settings)
    except Exception as exc:  # fallo del proveedor TTS / red → error visible, no silencio
        raise HTTPException(status_code=502, detail="No se pudo generar la narración.") from exc
    return Response(content=audio, media_type="audio/mpeg")


@router.post("/explain-image", response_model=ImageExplanationResponse)
async def explain_image_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    page: int | None = Form(default=None),
    context: str | None = Form(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> ImageExplanationResponse:
    """Explica bajo demanda una imagen REAL del documento (Hito 5h Parte 3, extensión de 4+6).

    Solo para fuentes binarias (PDF/imagen): el modelo relee el binario nativo y explica la imagen
    en lenguaje accesible. La atribución es la propia imagen (se muestra junto a ella en el
    `SourcePanel`). En fuentes de texto no hay imagen real que explicar → 400.
    """
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)
    extraction = prepare_input(
        text=text_value, binary=binary, media_type=media_type, filename=filename
    )
    if extraction.source_kind == "text":
        raise HTTPException(
            status_code=400, detail="Una fuente de texto no tiene imagen que explicar."
        )
    explanation = await explain_image(model, extraction, page=page, context=context)
    return ImageExplanationResponse(explanation=explanation)


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_endpoint(
    file: UploadFile = File(),
    settings: Settings = Depends(get_settings),
) -> TranscriptionResponse:
    """Transcribe una pregunta hablada a texto (entrada por voz del chat).

    Solo audio→texto; el usuario revisa y envía manualmente (nunca se envía ni se interpreta como
    comando). `503` si falta la clave de OpenAI, `502` si falla el proveedor — falla visible.
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


@router.post("/deck", response_model=GeneratedDeck)
async def deck_endpoint(
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    model: Model = Depends(get_model),
    settings: Settings = Depends(get_settings),
) -> GeneratedDeck:
    """Presentación en diapositivas GENERADA (guion propio, desde la fuente). On-demand.

    Relee el documento original (como el chat) y sintetiza un deck pensado para slides. Distinto de
    la vista de slides del 5h (re-composición sin generación). Si no hay clave de OpenAI, el deck se
    genera igual pero sin imágenes de apoyo (degradación honesta, no falla).
    """
    text_value, binary, media_type, filename = await _parse_inputs(text, file, settings)
    extraction = prepare_input(
        text=text_value, binary=binary, media_type=media_type, filename=filename
    )
    return await generate_deck(model, settings, extraction)


@router.post("/illustrations", response_model=IllustrationsResponse)
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
    for event in batch.events:
        record_ux_event(event, jsonl_dir=jsonl_dir)
    return Response(status_code=204)
