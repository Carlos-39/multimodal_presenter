"""Biblioteca: guardar, listar y recuperar presentaciones de un usuario.

**Toda consulta filtra por usuario.** No hay una función que recupere una presentación "por id" a
secas: el id del dueño es siempre parte de la condición. Es deliberado — una función así existiría
para que alguien la llamara sin el filtro, y bastaría un descuido en un endpoint para que
cualquiera leyera la biblioteca de otro. Lo que no existe no se puede olvidar de usar.
"""

from __future__ import annotations

import uuid

import aiosqlite

from ..schemas.library import (
    VERSION_CONTRATO,
    PayloadGuardado,
    PresentacionCompleta,
    ResumenPresentacion,
)
from .db import ahora


async def guardar(
    conn: aiosqlite.Connection,
    *,
    usuario_id: str,
    document_id: str,
    titulo: str,
    payload: PayloadGuardado,
) -> str:
    """Guarda una presentación y deja constancia de que el usuario tiene ese documento.

    El documento ya debe estar en el almacén: aquí solo se registra la relación. Las dos
    escrituras van en la misma transacción para que no quede una presentación apuntando a un
    documento que su dueño no tiene registrado.
    """
    presentacion_id = f"pre-{uuid.uuid4().hex[:16]}"
    momento = ahora()

    # La propiedad registra la RELACIÓN usuario-documento; el título va en la presentación. Dos
    # presentaciones del mismo texto comparten documento (el id es por contenido), así que un
    # título en esta tabla haría que la segunda heredara el nombre de la primera.
    await conn.execute(
        "INSERT INTO propiedad (usuario_id, document_id, creado_en, abierto_en) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT(usuario_id, document_id) DO UPDATE SET abierto_en = excluded.abierto_en",
        (usuario_id, document_id, momento, momento),
    )
    await conn.execute(
        "INSERT INTO presentaciones "
        "  (id, usuario_id, document_id, titulo, version_contrato, payload_json, creada_en, "
        "   secciones, verificadas) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            presentacion_id,
            usuario_id,
            document_id,
            titulo,
            VERSION_CONTRATO,
            payload.model_dump_json(),
            momento,
            payload.grounding.total_sections,
            payload.grounding.verified_sections,
        ),
    )
    await conn.commit()
    return presentacion_id


async def actualizar(
    conn: aiosqlite.Connection,
    usuario_id: str,
    presentacion_id: str,
    *,
    titulo: str,
    payload: PayloadGuardado,
) -> bool:
    """Reemplaza el contenido de una presentación DEL USUARIO. `False` si no es suya.

    Existe porque lo que hay en pantalla puede crecer DESPUÉS de haberlo guardado: las
    ilustraciones de apoyo llegan en un post-pase, así que quien guarda en cuanto aparecen las
    secciones y vuelve a pulsar diez segundos más tarde está pidiendo completar lo guardado, no
    duplicarlo.

    No se toca `creada_en`: la presentación es la misma: solo se actualiza qué contiene. Y no se
    toca el documento, que es el mismo por definición — si cambiara, sería otra presentación.
    """
    cur = await conn.execute(
        "UPDATE presentaciones SET titulo = ?, version_contrato = ?, payload_json = ?, "
        "  secciones = ?, verificadas = ? "
        "WHERE id = ? AND usuario_id = ?",
        (
            titulo,
            VERSION_CONTRATO,
            payload.model_dump_json(),
            payload.grounding.total_sections,
            payload.grounding.verified_sections,
            presentacion_id,
            usuario_id,
        ),
    )
    await conn.commit()
    return cur.rowcount > 0


async def listar(conn: aiosqlite.Connection, usuario_id: str) -> list[ResumenPresentacion]:
    """Las presentaciones del usuario, la más reciente primero. SIN el payload.

    Listar no debe traerse el contenido: un deck con imágenes pesa megas, y la lista solo necesita
    de qué es cada cosa.
    """
    async with conn.execute(
        "SELECT p.id, p.document_id, p.creada_en, p.secciones, p.verificadas, "
        "       COALESCE(p.titulo, '(sin título)') AS titulo, "
        "       d.source_kind, d.nombre_archivo "
        "FROM presentaciones p "
        "JOIN documentos d ON d.document_id = p.document_id "
        "WHERE p.usuario_id = ? "
        "ORDER BY p.creada_en DESC",
        (usuario_id,),
    ) as cur:
        filas = await cur.fetchall()

    return [
        ResumenPresentacion(
            id=f["id"],
            titulo=f["titulo"],
            document_id=f["document_id"],
            source_kind=f["source_kind"],
            nombre_archivo=f["nombre_archivo"],
            creada_en=f["creada_en"],
            secciones=f["secciones"],
            verificadas=f["verificadas"],
        )
        for f in filas
    ]


async def obtener(
    conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str
) -> PresentacionCompleta | None:
    """Una presentación DEL USUARIO, o `None`.

    `None` tanto si no existe como si es de otra persona: distinguir los dos casos revelaría qué
    identificadores están en uso. Es el mismo criterio que el error de inicio de sesión.
    """
    async with conn.execute(
        "SELECT p.*, d.source_kind, d.nombre_archivo, d.media_type, "
        "       COALESCE(p.titulo, '(sin título)') AS titulo "
        "FROM presentaciones p "
        "JOIN documentos d ON d.document_id = p.document_id "
        "WHERE p.id = ? AND p.usuario_id = ?",
        (presentacion_id, usuario_id),
    ) as cur:
        fila = await cur.fetchone()

    if fila is None:
        return None

    await conn.execute(
        "UPDATE propiedad SET abierto_en = ? WHERE usuario_id = ? AND document_id = ?",
        (ahora(), usuario_id, fila["document_id"]),
    )
    await conn.commit()

    return PresentacionCompleta(
        id=fila["id"],
        titulo=fila["titulo"],
        document_id=fila["document_id"],
        source_kind=fila["source_kind"],
        nombre_archivo=fila["nombre_archivo"],
        media_type=fila["media_type"],
        creada_en=fila["creada_en"],
        payload=PayloadGuardado.model_validate_json(fila["payload_json"]),
    )


async def borrar(conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str) -> bool:
    """Borra una presentación del usuario. Devuelve si había algo que borrar.

    Una biblioteca sin forma de podarla es una trampa: se llena de pruebas y acaba inservible.
    Los bytes del documento NO se borran: pueden estar compartidos con otra presentación o con
    otro usuario, porque el almacén es direccionable por contenido.
    """
    cur = await conn.execute(
        "DELETE FROM presentaciones WHERE id = ? AND usuario_id = ?",
        (presentacion_id, usuario_id),
    )
    await conn.commit()
    return cur.rowcount > 0


async def tiene_documento(conn: aiosqlite.Connection, usuario_id: str, document_id: str) -> bool:
    """¿Este usuario tiene registrado ese documento?

    Es la comprobación que permite mandar `document_id` en vez del archivo: sin ella, bastaría
    conocer un id para leer el documento de otra persona.
    """
    async with conn.execute(
        "SELECT 1 FROM propiedad WHERE usuario_id = ? AND document_id = ?",
        (usuario_id, document_id),
    ) as cur:
        return await cur.fetchone() is not None
