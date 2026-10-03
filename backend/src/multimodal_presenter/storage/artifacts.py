"""Artefactos generados de una presentación guardada: el deck y la narración.

Se GUARDAN en vez de regenerarse, y el motivo principal no es el costo. Regenerar da un artefacto
distinto cada vez: el modelo redacta otras diapositivas y la voz lee otro guion. Si alguien guarda
"su" presentación y al volver el deck es otro, no era suya. Ahorrarse el TTS y la síntesis es un
efecto secundario agradable, no la razón.

Las ilustraciones NO están aquí, y no es un olvido: viven dentro de `Section.illustration`, que es
parte del contrato, así que ya viajan en el payload de la presentación y se restauran con ella.

Dos sitios distintos para dos cosas distintas:

- El **deck** es JSON y va a la base. Puede pesar megas cuando lleva ilustraciones (son data
  URIs), así que NO viaja en la respuesta de abrir una presentación: se pide aparte, cuando quien
  la abre pulsa para verla. Abrir una presentación tiene que ser inmediato.
- La **narración** son bytes de mp3 y van a un archivo. Meter un mp3 en una columna de texto
  obligaría a codificarlo en base64, un tercio más grande y sin poder escucharlo a mano.

Como en el resto de la biblioteca, **toda consulta filtra por usuario**.
"""

from __future__ import annotations

from pathlib import Path

import aiosqlite

from ..config import Settings
from ..schemas.transform import GeneratedDeck
from .db import ahora, resolve_data_dir

_CARPETA = "narraciones"


def _ruta(settings: Settings, nombre: str) -> Path:
    return resolve_data_dir(settings) / nombre


async def _es_suya(conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str) -> bool:
    async with conn.execute(
        "SELECT 1 FROM presentaciones WHERE id = ? AND usuario_id = ?",
        (presentacion_id, usuario_id),
    ) as cur:
        return await cur.fetchone() is not None


async def _guardar(
    conn: aiosqlite.Connection,
    presentacion_id: str,
    tipo: str,
    *,
    payload_json: str | None = None,
    ruta_bytes: str | None = None,
) -> None:
    """Deja UN artefacto de ese tipo, reemplazando el anterior si lo había."""
    await conn.execute(
        "INSERT INTO artefactos (presentacion_id, tipo, payload_json, ruta_bytes, creado_en) "
        "VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(presentacion_id, tipo) DO UPDATE SET "
        "  payload_json = excluded.payload_json, "
        "  ruta_bytes = excluded.ruta_bytes, "
        "  creado_en = excluded.creado_en",
        (presentacion_id, tipo, payload_json, ruta_bytes, ahora()),
    )
    await conn.commit()


async def guardar_deck(
    conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str, deck: GeneratedDeck
) -> bool:
    """Guarda el deck de una presentación del usuario. `False` si no es suya."""
    if not await _es_suya(conn, usuario_id, presentacion_id):
        return False
    await _guardar(conn, presentacion_id, "deck", payload_json=deck.model_dump_json())
    return True


async def deck(
    conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str
) -> GeneratedDeck | None:
    """El deck guardado de una presentación DEL USUARIO, o `None`.

    Se valida al leer, igual que el historial del chat: el contrato del deck ya creció dos veces
    (`start_s`, `region`), y si un deck viejo dejara de ser válido es mejor saberlo aquí que
    pintar diapositivas incoherentes.
    """
    async with conn.execute(
        "SELECT a.payload_json FROM artefactos a "
        "JOIN presentaciones p ON p.id = a.presentacion_id "
        "WHERE a.presentacion_id = ? AND a.tipo = 'deck' AND p.usuario_id = ?",
        (presentacion_id, usuario_id),
    ) as cur:
        fila = await cur.fetchone()

    if fila is None or fila["payload_json"] is None:
        return None
    return GeneratedDeck.model_validate_json(fila["payload_json"])


async def guardar_narracion(
    conn: aiosqlite.Connection,
    settings: Settings,
    usuario_id: str,
    presentacion_id: str,
    audio: bytes,
) -> bool:
    """Guarda el mp3 de la narración. `False` si la presentación no es del usuario.

    La ruta se guarda RELATIVA a la carpeta de datos. Una ruta absoluta deja de valer en cuanto
    la carpeta se mueve o el proyecto se abre en otra máquina, y entonces la fila dice que hay
    narración y el archivo no aparece.
    """
    if not await _es_suya(conn, usuario_id, presentacion_id):
        return False

    nombre = f"{_CARPETA}/{presentacion_id}.mp3"
    destino = _ruta(settings, nombre)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(audio)
    await _guardar(conn, presentacion_id, "narracion", ruta_bytes=nombre)
    return True


async def narracion(
    conn: aiosqlite.Connection, settings: Settings, usuario_id: str, presentacion_id: str
) -> bytes | None:
    """Los bytes del mp3 guardado, o `None` si no hay (o si la presentación no es del usuario)."""
    async with conn.execute(
        "SELECT a.ruta_bytes FROM artefactos a "
        "JOIN presentaciones p ON p.id = a.presentacion_id "
        "WHERE a.presentacion_id = ? AND a.tipo = 'narracion' AND p.usuario_id = ?",
        (presentacion_id, usuario_id),
    ) as cur:
        fila = await cur.fetchone()

    if fila is None or not fila["ruta_bytes"]:
        return None
    archivo = _ruta(settings, fila["ruta_bytes"])
    # El archivo puede faltar aunque la fila esté: alguien limpió la carpeta a mano. Se responde
    # "no hay" y se regenera, que es preferible a un error que no dice nada.
    return archivo.read_bytes() if archivo.is_file() else None


async def olvidar_bytes(
    conn: aiosqlite.Connection, settings: Settings, usuario_id: str, presentacion_id: str
) -> None:
    """Borra el mp3 del disco antes de que se borre la presentación.

    Las filas se van solas con el `ON DELETE CASCADE`, pero un archivo no. Y este sí se puede
    borrar, al contrario que los bytes del documento: la narración es de UNA presentación, no es
    direccionable por contenido y nadie más la comparte. Sin esto, cada presentación borrada
    dejaría un mp3 huérfano que nada volvería a nombrar.
    """
    audio = await narracion(conn, settings, usuario_id, presentacion_id)
    if audio is None:
        return
    _ruta(settings, f"{_CARPETA}/{presentacion_id}.mp3").unlink(missing_ok=True)


async def cuales(conn: aiosqlite.Connection, usuario_id: str, presentacion_id: str) -> set[str]:
    """Qué artefactos tiene guardados, sin traerse ninguno.

    Es lo que deja que el botón diga "Abrir presentación" en vez de "Generar presentación" nada
    más restaurar, sin descargar megas de diapositivas que quizá nadie mire.
    """
    async with conn.execute(
        "SELECT a.tipo FROM artefactos a "
        "JOIN presentaciones p ON p.id = a.presentacion_id "
        "WHERE a.presentacion_id = ? AND p.usuario_id = ?",
        (presentacion_id, usuario_id),
    ) as cur:
        return {fila["tipo"] for fila in await cur.fetchall()}
