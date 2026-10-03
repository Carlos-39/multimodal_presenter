"""Historial de chat de una presentación guardada.

Cierra el pendiente declarado en el Hito 6: hasta ahora la conversación vivía solo en memoria del
navegador y se perdía al recargar, con la nota de que "el futuro login traerá su modelo de sesión
y ESE hito reemplaza este almacenamiento". Este es ese hito.

Dos decisiones que son el fondo del módulo:

**El historial se ata a la PRESENTACIÓN, no al usuario+documento.** Las respuestas del chat están
ancladas a `section_id` concretos de *esa* generación. Atado al documento, volver a transformarlo
dejaría el historial apuntando a secciones que ya no existen: citas colgando de nada.

**Se reemplaza entero, no se añade turno a turno.** Lo guardado es siempre una foto de lo que se
está viendo, así que no puede derivar. Añadiendo, un reintento duplicaría un turno y una petición
perdida dejaría un hueco — y un historial con huecos es peor que no tenerlo, porque parece
completo.

Como en el resto de la biblioteca, **toda consulta filtra por usuario**. No hay una función que
lea el historial "de una presentación" a secas.
"""

from __future__ import annotations

import uuid

import aiosqlite

from ..schemas.chat import ChatResponse
from ..schemas.library import MensajeGuardado
from .db import ahora


async def _es_suya(conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str) -> bool:
    async with conn.execute(
        "SELECT 1 FROM presentaciones WHERE id = ? AND usuario_id = ?",
        (presentacion_id, usuario_id),
    ) as cur:
        return await cur.fetchone() is not None


async def reemplazar(
    conn: aiosqlite.Connection,
    usuario_id: str,
    presentacion_id: str,
    mensajes: list[MensajeGuardado],
) -> bool:
    """Deja el historial exactamente como se recibe. Devuelve `False` si no es del usuario.

    El borrado y las inserciones van en la misma transacción: si se interrumpiera a medias, un
    historial vacío o cortado se vería como una conversación que nunca ocurrió.
    """
    if not await _es_suya(conn, usuario_id, presentacion_id):
        return False

    momento = ahora()
    await conn.execute("DELETE FROM mensajes_chat WHERE presentacion_id = ?", (presentacion_id,))
    await conn.executemany(
        "INSERT INTO mensajes_chat "
        "  (id, presentacion_id, orden, rol, texto, respuesta_json, creado_en) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                f"msg-{uuid.uuid4().hex[:16]}",
                presentacion_id,
                orden,
                m.rol,
                m.texto,
                m.respuesta.model_dump_json() if m.respuesta is not None else None,
                momento,
            )
            for orden, m in enumerate(mensajes)
        ],
    )
    await conn.commit()
    return True


async def historial(
    conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str
) -> list[MensajeGuardado]:
    """El historial de una presentación DEL USUARIO, en orden. Lista vacía si no es suya.

    El `JOIN` con `presentaciones` es lo que impone la propiedad: sin él bastaría conocer un id de
    presentación para leer la conversación de otra persona.
    """
    async with conn.execute(
        "SELECT m.rol, m.texto, m.respuesta_json "
        "FROM mensajes_chat m "
        "JOIN presentaciones p ON p.id = m.presentacion_id "
        "WHERE m.presentacion_id = ? AND p.usuario_id = ? "
        "ORDER BY m.orden",
        (presentacion_id, usuario_id),
    ) as cur:
        filas = await cur.fetchall()

    # Se valida al LEER y no solo al escribir porque el contrato del chat puede cambiar (ya pasó
    # con `region`): si una respuesta guardada dejara de ser válida, mejor enterarse aquí que
    # renderizar algo incoherente meses después.
    return [
        MensajeGuardado(
            rol=f["rol"],
            texto=f["texto"],
            respuesta=(
                None
                if f["respuesta_json"] is None
                else ChatResponse.model_validate_json(f["respuesta_json"])
            ),
        )
        for f in filas
    ]
