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
import re
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


#: Las dos formas de id que el sistema convierte en nombre de archivo: `doc-` y doce dígitos
#: hexadecimales (el principio del sha256 del contenido) y `pre-` y dieciséis (un uuid recortado).
_FORMAS_DE_ID = re.compile(r"doc-[0-9a-f]{12}|pre-[0-9a-f]{16}")


def valida_id_de_ruta(identificador: str) -> str:
    """Devuelve el id si puede formar parte de una ruta; lanza `ValueError` si no.

    **No es validación de entrada: es cerrar la puerta por dentro.** Hoy no se puede llegar aquí
    con un id inventado, porque los dos caminos que leen del disco comprueban antes la propiedad
    contra la base y un id con `..` dentro no está en ninguna tabla. Pero esa defensa vive en los
    endpoints, no en la función que arma la ruta: el día que alguien añada un tercer camino y se le
    olvide, `resolve_data_dir() / id` se sale de la carpeta de datos sin que nada lo impida.

    Así que la comprobación va donde se construye la ruta, que es el único sitio donde no se puede
    olvidar. Y comprueba la FORMA en vez de buscar `..`: una lista de lo que se admite no se queda
    corta, y una lista de lo que se prohíbe siempre acaba quedándose corta.
    """
    if not _FORMAS_DE_ID.fullmatch(identificador):
        raise ValueError(f"id con forma inválida para una ruta: {identificador!r}")
    return identificador


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
        # Los cursores se CIERRAN. `journal_mode` devuelve una fila, así que su cursor se queda
        # abierto si nadie lo recoge, y para SQLite eso es «hay sentencias en marcha»: `VACUUM
        # INTO` —el respaldo consistente— se niega a correr con una abierta. Lo demás funcionaba
        # igual, así que la fuga no se notaba hasta que algo la pisó.
        for pragma in ("PRAGMA foreign_keys = ON", "PRAGMA journal_mode = WAL"):
            cursor = await conn.execute(pragma)
            await cursor.close()
        yield conn
    finally:
        await conn.close()


async def respaldar(settings: Settings, destino: Path) -> Path:
    """Copia consistente de la base, con la aplicación corriendo. Devuelve la ruta escrita.

    **No es `cp`, y la diferencia importa.** Copiar el archivo en caliente puede pillar la base a
    mitad de una transacción, y con WAL hay además un segundo archivo —el `-wal`— con cambios que
    todavía no están en el principal: la copia resultante puede abrir perfectamente y haber perdido
    lo último, o no abrir. `VACUUM INTO` lo hace desde dentro de SQLite, que sabe esperar a un
    punto coherente, y de paso compacta.

    Se ejecuta por la conexión de siempre, así que no hace falta el ejecutable `sqlite3` en la
    imagen ni una dependencia nueva.

    SQLite se niega a escribir sobre un archivo que ya existe, y aquí eso es una virtud: un
    respaldo no puede pisar a otro por un nombre repetido.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    async with conectar(settings) as conn:
        await conn.execute("VACUUM INTO ?", (str(destino),))
    return destino


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
