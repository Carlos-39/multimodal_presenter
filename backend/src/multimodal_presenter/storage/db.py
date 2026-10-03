"""Base de datos: conexión y migraciones.

SQLite y no Postgres, y no es la opción "de juguete": para un prototipo que se usa en sesiones
presenciales de una persona a la vez, un servidor que hay que levantar antes de cada sesión es
una pieza más que puede fallar delante del participante. La que añade riesgo es la otra.

Sin ORM a propósito. Seis tablas no lo justifican, y SQLModel arrastraría SQLAlchemy y su propio
modelo de usuario, que pelearía con la decisión de mantener la propiedad FUERA del contrato. Las
migraciones son scripts SQL numerados y un corredor de cuarenta líneas: auditable de un vistazo,
que es como está hecho el resto del proyecto.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

import aiosqlite
import logfire

from ..config import Settings

_MIGRACIONES = Path(__file__).resolve().parent / "migrations"


def resolve_data_dir(settings: Settings) -> Path:
    """Carpeta de datos: la base y los documentos subidos.

    Precedencia: `DATA_DIR` explícito > un default FUERA de OneDrive. Lo segundo no es manía:
    OneDrive sincronizando un archivo que se escribe en caliente corrompe bases SQLite, y por eso
    mismo la telemetría ya vive fuera.
    """
    if settings.data_dir:
        return Path(settings.data_dir)
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_DATA_HOME") or str(Path.home())
    return Path(base) / "mmpresenter_data"


def db_path(settings: Settings) -> Path:
    return resolve_data_dir(settings) / "mmpresenter.db"


def ahora() -> str:
    """Marca de tiempo UTC en ISO-8601. SQLite no tiene tipo fecha: se guarda texto ordenable."""
    return datetime.now(UTC).isoformat()


@asynccontextmanager
async def conectar(settings: Settings) -> AsyncIterator[aiosqlite.Connection]:
    """Abre una conexión con los PRAGMA correctos puestos.

    Dos ajustes que son fáciles de dar por supuestos y no lo son:

    - `foreign_keys=ON` es **por conexión** y viene apagado por defecto en SQLite. Sin él, los
      `ON DELETE CASCADE` del esquema no hacen nada y borrar un usuario deja sus presentaciones
      colgando. Hay un test que lo fija.
    - `journal_mode=WAL` deja que una lectura no bloquee a una escritura. Es persistente en el
      archivo, pero se pide igual en cada conexión porque es barato y así no depende de que
      alguien lo pusiera una vez.
    """
    carpeta = resolve_data_dir(settings)
    carpeta.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(db_path(settings))
    try:
        conn.row_factory = aiosqlite.Row  # filas por nombre de columna, no por posición
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA journal_mode = WAL")
        yield conn
    finally:
        await conn.close()


async def migrar(settings: Settings) -> list[int]:
    """Aplica las migraciones pendientes. Devuelve las versiones aplicadas en esta llamada.

    Idempotente: correrla dos veces no hace nada la segunda. Cada migración va en su propia
    transacción, así que una que falle no deja el esquema a medias.
    """
    aplicadas: list[int] = []
    async with conectar(settings) as conn:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS migraciones ("
            "  version INTEGER PRIMARY KEY,"
            "  aplicada_en TEXT NOT NULL"
            ")"
        )
        await conn.commit()

        async with conn.execute("SELECT version FROM migraciones") as cur:
            ya = {fila["version"] for fila in await cur.fetchall()}

        for script in sorted(_MIGRACIONES.glob("*.sql")):
            version = int(script.name.split("_", 1)[0])
            if version in ya:
                continue
            await conn.executescript(script.read_text(encoding="utf-8"))
            await conn.execute(
                "INSERT INTO migraciones (version, aplicada_en) VALUES (?, ?)",
                (version, ahora()),
            )
            await conn.commit()
            aplicadas.append(version)
            logfire.info("migración aplicada: {script}", script=script.name)

    return aplicadas
