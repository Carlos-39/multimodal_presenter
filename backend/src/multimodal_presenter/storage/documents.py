"""Almacén de documentos: los bytes originales de lo que la gente sube.

**Por qué guardarlos y no solo la presentación.** Hoy el frontend conserva el `File` y lo reenvía
en cada petición. Quien vuelva mañana desde otro navegador no lo tiene — y el documento original
hace falta para el chat, las sugeridas, el deck, las ilustraciones, la narración, el visor de
página y el **panel de fuente**. Una presentación guardada sin su documento se puede leer pero no
interrogar ni verificar, y la verificabilidad es justo lo que este proyecto afirma.

**Direccionable por contenido.** La clave es el `document_id` que ya calcula el pipeline:
`doc-{sha256(bytes)[:12]}`. Eso da tres cosas gratis: el mismo documento subido dos veces ocupa
una sola copia, la ruta se deriva del id (no hay una ruta guardada que pueda desincronizarse), y
guardar es idempotente.

Todo se guarda como BYTES, también las fuentes de texto: el pipeline ya calcula su id sobre
`texto.encode("utf-8")`, así que tratar ambos casos igual evita una bifurcación que no aporta.
"""

from __future__ import annotations

from pathlib import Path

import aiosqlite

from ..config import Settings
from ..pipeline.extraction import compute_document_id
from .db import ahora, resolve_data_dir, valida_id_de_ruta


def ruta_de(settings: Settings, document_id: str) -> Path:
    """Ruta en disco de un documento. Se DERIVA del id, nunca se guarda en la base.

    Lanza `ValueError` si el id no tiene forma de id: ver `valida_id_de_ruta`.
    """
    return resolve_data_dir(settings) / "documentos" / valida_id_de_ruta(document_id)


async def guardar(
    conn: aiosqlite.Connection,
    settings: Settings,
    *,
    document_id: str,
    source_kind: str,
    contenido: bytes,
    nombre_archivo: str | None = None,
    media_type: str | None = None,
) -> None:
    """Guarda los bytes y registra el documento. Idempotente.

    Comprueba que el id CORRESPONDA al contenido antes de escribir. No es paranoia: el id es la
    ruta y la clave primaria, así que guardar bytes bajo un id ajeno dejaría el almacén mintiendo
    de una forma que después no se puede detectar. Es la clase de error que conviene hacer
    imposible, no vigilar.
    """
    esperado = compute_document_id(contenido)
    if esperado != document_id:
        raise ValueError(
            f"el id no corresponde al contenido: se pidió {document_id}, los bytes dan {esperado}"
        )

    destino = ruta_de(settings, document_id)
    if not destino.exists():
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(contenido)

    await conn.execute(
        "INSERT INTO documentos "
        "  (document_id, source_kind, nombre_archivo, media_type, tamano_bytes, creado_en) "
        "VALUES (?, ?, ?, ?, ?, ?) "
        "ON CONFLICT(document_id) DO NOTHING",
        (document_id, source_kind, nombre_archivo, media_type, len(contenido), ahora()),
    )
    await conn.commit()


async def leer(settings: Settings, document_id: str) -> bytes | None:
    """Los bytes del documento, o `None` si no está. Nunca lanza por un documento ausente.

    Un id que no tiene forma de id tampoco tiene documento, así que también es `None`: para quien
    llama es la misma ausencia, y lanzar aquí convertiría un 404 honesto en un 500.
    """
    try:
        destino = ruta_de(settings, document_id)
    except ValueError:
        return None
    if not destino.exists():
        return None
    return destino.read_bytes()


async def metadatos(conn: aiosqlite.Connection, document_id: str) -> aiosqlite.Row | None:
    async with conn.execute(
        "SELECT * FROM documentos WHERE document_id = ?", (document_id,)
    ) as cur:
        return await cur.fetchone()
