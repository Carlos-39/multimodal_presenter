"""Biblioteca: guardar una presentación y volver a ella después.

Estos son los únicos endpoints que EXIGEN cuenta. Todo lo demás sigue funcionando sin ella: las
sesiones de evaluación del Hito 8 corren sin login, y entrar añade *guardar y volver*, no
habilita usar el sistema.

El documento viaja con la presentación al guardarla, y no se guarda solo al transformar. Es
deliberado: así no se almacena el documento de alguien que nunca pidió guardar nada. Guardar es
un acto explícito y lleva consigo lo que hace falta para que lo guardado siga sirviendo.
"""

from __future__ import annotations

import aiosqlite
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile

from ..config import Settings, get_settings
from ..pipeline.extraction import prepare_input
from ..schemas.library import (
    HistorialChat,
    ListaPresentaciones,
    PayloadGuardado,
    PresentacionCompleta,
    ResumenPresentacion,
)
from ..storage import chat as chat_repo
from ..storage import conectar
from ..storage import documents as almacen
from ..storage import presentations as repo
from .auth import usuario_actual
from .routes import parse_document_inputs

router = APIRouter(prefix="/biblioteca", tags=["biblioteca"])


@router.post("/presentaciones", response_model=ResumenPresentacion, status_code=201)
async def guardar_endpoint(
    payload: str = Form(...),
    titulo: str = Form(...),
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> ResumenPresentacion:
    """Guarda una presentación junto con el documento del que salió.

    El payload se VALIDA aquí contra el contrato antes de escribirlo. Guardar algo corrupto es
    fácil de no notar hasta meses después, cuando ya no se puede reconstruir qué pasó.
    """
    try:
        datos = PayloadGuardado.model_validate_json(payload)
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
    return presentacion.model_copy(update={"chat": historial})


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
        # El contenido de un id NUNCA cambia: es un hash de esos mismos bytes.
        headers={"Cache-Control": "private, max-age=86400, immutable"},
    )


@router.delete("/presentaciones/{presentacion_id}", status_code=204)
async def borrar_endpoint(
    presentacion_id: str,
    usuario: aiosqlite.Row = Depends(usuario_actual),
    settings: Settings = Depends(get_settings),
) -> None:
    """Borra una presentación. Una biblioteca que no se puede podar acaba inservible.

    Los bytes del documento no se borran: el almacén es direccionable por contenido, así que
    pueden estar compartidos con otra presentación o con otro usuario.
    """
    async with conectar(settings) as conn:
        if not await repo.borrar(conn, usuario["id"], presentacion_id):
            raise HTTPException(status_code=404, detail="No se encontró esa presentación.")
