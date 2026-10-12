"""Biblioteca: guardar una presentación y volver a ella después.

Estos son los únicos endpoints que EXIGEN cuenta. Todo lo demás sigue funcionando sin ella: las
sesiones de evaluación del Hito 8 corren sin login, y entrar añade *guardar y volver*, no
habilita usar el sistema.

El documento viaja con la presentación al guardarla, y no se guarda solo al transformar. Es
deliberado: así no se almacena el documento de alguien que nunca pidió guardar nada. Guardar es
un acto explícito y lleva consigo lo que hace falta para que lo guardado siga sirviendo.
"""

from __future__ import annotations

from urllib.parse import quote

import aiosqlite
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile

from ..config import Settings, get_settings
from ..pipeline.extraction import prepare_input
from ..schemas.library import (
    ActualizacionPresentacion,
    HistorialChat,
    ListaPresentaciones,
    PayloadGuardado,
    PresentacionCompleta,
    ResumenPresentacion,
)
from ..schemas.transform import GeneratedDeck
from ..storage import artifacts as artefactos
from ..storage import chat as chat_repo
from ..storage import conectar
from ..storage import documents as almacen
from ..storage import presentations as repo
from .auth import usuario_actual
from .routes import parse_document_inputs

router = APIRouter(prefix="/biblioteca", tags=["biblioteca"])

MAX_PAYLOAD_BYTES = 25 * 1024 * 1024
"""Tope del payload guardado. Una presentación con cuatro ilustraciones ronda los 4 MB (son data
URIs); 25 deja aire de sobra y evita que un cuerpo enorme llene el disco antes de validarlo."""

MAX_NARRACION_BYTES = 25 * 1024 * 1024
"""Tope del mp3. Una narración de un documento normal ronda el megabyte; 25 deja muchísimo aire
y evita que un cuerpo enorme llene el disco antes de que nadie lo mire."""


def _parece_mp3(datos: bytes) -> bool:
    """¿Empieza como un mp3? Etiqueta `ID3` o sincronismo de trama (`0xFFE…`).

    No es una validación completa del formato y no pretende serlo: descarta lo que claramente no
    es audio sin arrastrar una dependencia para analizar mp3.
    """
    return datos.startswith(b"ID3") or (
        len(datos) >= 2 and datos[0] == 0xFF and (datos[1] & 0xE0) == 0xE0
    )


@router.post("/presentaciones", response_model=ResumenPresentacion, status_code=201)
async def guardar_endpoint(
    payload: UploadFile = File(...),
    titulo: str = Form(...),
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> ResumenPresentacion:
    """Guarda una presentación junto con el documento del que salió.

    El payload viaja como PARTE DE ARCHIVO, no como campo de formulario. No es capricho: el
    analizador de multipart topa en 1 MB las partes que no son archivo, y un payload con
    ilustraciones son varios megas porque son data URIs. Como campo, guardar una presentación
    ilustrada fallaba con un 400 y la interfaz solo decía "No se pudo guardar".

    El payload se VALIDA aquí contra el contrato antes de escribirlo. Guardar algo corrupto es
    fácil de no notar hasta meses después, cuando ya no se puede reconstruir qué pasó.
    """
    crudo = await payload.read()
    if len(crudo) > MAX_PAYLOAD_BYTES:
        raise HTTPException(status_code=413, detail="La presentación es demasiado grande.")
    try:
        datos = PayloadGuardado.model_validate_json(crudo)
    except Exception as exc:  # noqa: BLE001 — un payload inválido es error de quien llama
        raise HTTPException(status_code=422, detail="La presentación no es válida.") from exc

    text_value, binario, media_type, nombre = await parse_document_inputs(text, file, settings)
    extraction = prepare_input(
        text=text_value, binary=binario, media_type=media_type, filename=nombre
    )
    contenido = binario if binario is not None else (text_value or "").encode("utf-8")

    async with conectar(settings) as conn:
        await almacen.guardar(
            conn,
            settings,
            document_id=extraction.document_id,
            source_kind=extraction.source_kind,
            contenido=contenido,
            nombre_archivo=nombre,
            media_type=media_type,
        )
        presentacion_id = await repo.guardar(
            conn,
            usuario_id=usuario["id"],
            document_id=extraction.document_id,
            titulo=titulo.strip() or "(sin título)",
            payload=datos,
        )
        presentaciones = await repo.listar(conn, usuario["id"])

    return next(p for p in presentaciones if p.id == presentacion_id)


@router.put("/presentaciones/{presentacion_id}", status_code=204)
async def actualizar_endpoint(
    presentacion_id: str,
    cambio: ActualizacionPresentacion,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> None:
    """Actualiza una presentación ya guardada en vez de crear otra.

    Pulsar «Guardar» dos veces creaba dos presentaciones con el mismo nombre. Y no bastaba con
    deshabilitar el botón: lo que hay en pantalla PUEDE crecer después de guardarlo, porque las
    ilustraciones de apoyo llegan en un post-pase. Quien guarda en cuanto aparecen las secciones y
    vuelve a pulsar diez segundos más tarde está pidiendo completar lo guardado, no duplicarlo.

    Cuerpo JSON y no formulario: aquí no hay documento que subir, y un payload ilustrado son
    varios megas, por encima del tope de 1 MB que el multipart impone a los campos que no son
    archivo.

    No recibe el documento: es el mismo por definición. Si cambiara, sería otra presentación.
    """
    async with conectar(settings) as conn:
        actualizada = await repo.actualizar(
            conn,
            usuario["id"],
            presentacion_id,
            titulo=cambio.titulo.strip() or "(sin título)",
            payload=cambio.payload,
        )
    if not actualizada:
        raise HTTPException(status_code=404, detail="No se encontró esa presentación.")


@router.get("/presentaciones", response_model=ListaPresentaciones)
async def listar_endpoint(
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> ListaPresentaciones:
    """Mis presentaciones, la más reciente primero."""
    async with conectar(settings) as conn:
        return ListaPresentaciones(presentaciones=await repo.listar(conn, usuario["id"]))


@router.get("/presentaciones/{presentacion_id}", response_model=PresentacionCompleta)
async def obtener_endpoint(
    presentacion_id: str,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> PresentacionCompleta:
    """Una presentación guardada, con el `document_id` y su conversación, para seguir usándola.

    404 tanto si no existe como si es de otra persona: distinguir los dos casos revelaría qué
    identificadores están en uso, igual que el error de inicio de sesión no dice si el correo
    existe.

    El historial de chat viaja en esta MISMA respuesta. Con una segunda petición habría un
    instante en el que la presentación ya está en pantalla y su conversación todavía no, y ese
    instante se ve: parecería que se perdió.
    """
    async with conectar(settings) as conn:
        presentacion = await repo.obtener(conn, usuario["id"], presentacion_id)
        if presentacion is None:
            raise HTTPException(status_code=404, detail="No se encontró esa presentación.")
        historial = await chat_repo.historial(conn, usuario["id"], presentacion_id)
        guardados = await artefactos.cuales(conn, usuario["id"], presentacion_id)
    return presentacion.model_copy(
        update={
            "chat": historial,
            # Qué artefactos HAY, no los artefactos. Un deck con ilustraciones pesa megas y puede
            # que nadie lo abra; saber que existe basta para no ofrecer generarlo otra vez.
            "tiene_deck": "deck" in guardados,
            "tiene_narracion": "narracion" in guardados,
        }
    )


@router.put("/presentaciones/{presentacion_id}/chat", status_code=204)
async def guardar_chat_endpoint(
    presentacion_id: str,
    historial: HistorialChat,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> None:
    """Deja guardada la conversación de una presentación tal como está ahora.

    `PUT` y no `POST` porque reemplaza: el cliente manda el historial completo y eso es lo que
    queda. Añadir turno a turno sería más barato, pero el historial podría derivar de la
    conversación real —un reintento duplica, una petición perdida deja un hueco— y un historial
    con huecos es peor que ninguno, porque parece completo.
    """
    async with conectar(settings) as conn:
        if not await chat_repo.reemplazar(conn, usuario["id"], presentacion_id, historial.mensajes):
            raise HTTPException(status_code=404, detail="No se encontró esa presentación.")


# ─────────────────────────────────────────────────────────────
# Artefactos generados: deck y narración
#
# Se guardan en vez de regenerarse, y el motivo principal no es el costo: regenerar da un
# artefacto DISTINTO cada vez (otro guion, otra voz). Si alguien guarda "su" presentación y al
# volver el deck es otro, no era suya.
#
# Cada uno tiene su endpoint en vez de uno genérico por `tipo`: uno habla JSON y el otro bytes,
# y un endpoint que acepta ambos acaba decidiendo por el `Content-Type` qué validar — justo el
# tipo de rama en la que se cuela que algo entre sin comprobar.
# ─────────────────────────────────────────────────────────────


@router.put("/presentaciones/{presentacion_id}/artefactos/deck", status_code=204)
async def guardar_deck_endpoint(
    presentacion_id: str,
    deck: GeneratedDeck,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> None:
    """Guarda las diapositivas generadas. Se valida contra el contrato antes de escribir."""
    async with conectar(settings) as conn:
        if not await artefactos.guardar_deck(conn, usuario["id"], presentacion_id, deck):
            raise HTTPException(status_code=404, detail="No se encontró esa presentación.")


@router.get("/presentaciones/{presentacion_id}/artefactos/deck", response_model=GeneratedDeck)
async def deck_endpoint(
    presentacion_id: str,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> GeneratedDeck:
    """Las diapositivas guardadas. Se piden al pulsar para verlas, no al restaurar."""
    async with conectar(settings) as conn:
        guardado = await artefactos.deck(conn, usuario["id"], presentacion_id)
    if guardado is None:
        raise HTTPException(status_code=404, detail="Esa presentación no tiene diapositivas.")
    return guardado


@router.put("/presentaciones/{presentacion_id}/artefactos/narracion", status_code=204)
async def guardar_narracion_endpoint(
    presentacion_id: str,
    request: Request,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> None:
    """Guarda el mp3 de la narración, tal cual llega.

    Se comprueba que de verdad sea un mp3 y que quepa en el límite. No es desconfianza del
    frontend: es que lo que se escribe en disco con el nombre de alguien debe ser lo que dice
    ser, y un archivo que no suena es peor que no tener narración, porque parece que sí hay.
    """
    audio = await request.body()
    if not audio:
        raise HTTPException(status_code=400, detail="No llegó audio.")
    if len(audio) > MAX_NARRACION_BYTES:
        raise HTTPException(status_code=413, detail="La narración es demasiado grande.")
    if not _parece_mp3(audio):
        raise HTTPException(status_code=415, detail="Eso no es un mp3.")

    async with conectar(settings) as conn:
        if not await artefactos.guardar_narracion(
            conn, settings, usuario["id"], presentacion_id, audio
        ):
            raise HTTPException(status_code=404, detail="No se encontró esa presentación.")


@router.get("/presentaciones/{presentacion_id}/artefactos/narracion")
async def narracion_endpoint(
    presentacion_id: str,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> Response:
    """El mp3 guardado. Lo pide el reproductor al pulsar, no al restaurar."""
    async with conectar(settings) as conn:
        audio = await artefactos.narracion(conn, settings, usuario["id"], presentacion_id)
    if audio is None:
        raise HTTPException(status_code=404, detail="Esa presentación no tiene narración.")
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            # Privada y revalidable: el audio de una presentación no cambia mientras no se
            # regenere, pero no es inmutable como un documento (cuyo id ES su hash).
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/documentos/{document_id}")
async def documento_endpoint(
    document_id: str,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> Response:
    """Sirve los BYTES de un documento guardado.

    Sin esto, una presentación restaurada se podría leer pero no verificar: el panel de fuente, el
    visor de página y la vista del PDF necesitan el documento, y el navegador que la abre mañana
    ya no tiene el archivo. Guardar la presentación sin poder recuperar su fuente traicionaría lo
    que este proyecto afirma.

    Exige propiedad, igual que el camino por `document_id` del pipeline: un id es un hash del
    contenido, pero aun así conocerlo no puede bastar para leer el documento de otra persona.
    """
    async with conectar(settings) as conn:
        if not await repo.tiene_documento(conn, usuario["id"], document_id):
            raise HTTPException(status_code=404, detail="No se encontró ese documento.")
        fila = await almacen.metadatos(conn, document_id)

    contenido = await almacen.leer(settings, document_id)
    if fila is None or contenido is None:
        raise HTTPException(status_code=404, detail="No se encontró ese documento.")

    tipo = fila["media_type"] or "text/plain; charset=utf-8"
    return Response(
        content=contenido,
        media_type=tipo,
        headers={
            # El contenido de un id NUNCA cambia: es un hash de esos mismos bytes.
            "Cache-Control": "private, max-age=86400, immutable",
            # El tipo lo decidimos NOSOTROS, por los magic bytes del archivo y contra una
            # allowlist (ver `pipeline/uploads.py`), no por lo que diga el cliente. `nosniff` le
            # dice al navegador que no lo adivine por su cuenta: estos son bytes de otra persona
            # servidos desde nuestro propio origen, y ahí es donde adivinar sale caro.
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": _disposicion(fila["nombre_archivo"]),
        },
    )


def _disposicion(nombre: str | None) -> str:
    """`Content-Disposition` para servir un documento, con su nombre original si lo tiene.

    Se muestra en el navegador (`inline`), que es lo que necesita el panel de fuente: el visor de
    PDF y el `<img>` no descargan, enseñan.

    **El nombre lo eligió quien subió el archivo, así que se codifica en vez de interpolarse.** Un
    nombre con un salto de línea dentro partiría la cabecera en dos y dejaría añadir las que
    quisiera. La forma `filename*=UTF-8''…` de la RFC 6266 es además la única que admite acentos,
    así que lo seguro y lo correcto coinciden.
    """
    if not nombre:
        return "inline"
    return f"inline; filename*=UTF-8''{quote(nombre, safe='')}"


@router.delete("/presentaciones/{presentacion_id}", status_code=204)
async def borrar_endpoint(
    presentacion_id: str,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> None:
    """Borra una presentación. Una biblioteca que no se puede podar acaba inservible.

    Los bytes del documento no se borran: el almacén es direccionable por contenido, así que
    pueden estar compartidos con otra presentación o con otro usuario. El mp3 de la narración
    sí, porque es de ESTA presentación y nadie más lo comparte.
    """
    async with conectar(settings) as conn:
        # Antes de borrar la fila: después ya no habría cómo saber qué archivo era suyo, y el
        # mp3 quedaría en disco sin que nada vuelva a nombrarlo.
        await artefactos.olvidar_bytes(conn, settings, usuario["id"], presentacion_id)
        if not await repo.borrar(conn, usuario["id"], presentacion_id):
            raise HTTPException(status_code=404, detail="No se encontró esa presentación.")
