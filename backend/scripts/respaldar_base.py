"""Copia consistente de la base, con la aplicación corriendo.

**No es `cp`.** Copiar el archivo en caliente puede pillar la base a mitad de una transacción, y
con WAL hay además un segundo archivo con cambios que todavía no están en el principal: la copia
puede abrir perfectamente y haber perdido lo último, o no abrir. `VACUUM INTO` lo hace desde
dentro de SQLite, que sabe esperar a un punto coherente, y de paso compacta.

Dónde escribe por defecto, y por qué importa: **dentro del volumen**. Así la copia programada del
volumen se lleva un respaldo ya consistente, en vez de una foto del archivo vivo. Es lo que
convierte «hay copias» en «hay copias que sirven».

Uso:
    uv run python scripts/respaldar_base.py                 # al lado de la base
    uv run python scripts/respaldar_base.py --destino /datos/respaldos
    uv run python scripts/respaldar_base.py --mantener 7    # tira los más viejos

En el despliegue, por la CLI de la plataforma:
    railway ssh -- python /app/.venv/bin/python - <<< '...'   (ver el runbook)
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

from multimodal_presenter.config import get_settings
from multimodal_presenter.storage import db_path, respaldar
from multimodal_presenter.storage.db import resolve_data_dir


def _viejos_de_mas(carpeta: Path, mantener: int) -> list[Path]:
    """Los respaldos que sobran, del más viejo al más nuevo.

    Se ordena por NOMBRE y no por fecha del sistema de archivos: el nombre lleva la marca de
    tiempo y no cambia si alguien copia los archivos de sitio, que es justo lo que pasa cuando se
    restaura un volumen.
    """
    todos = sorted(carpeta.glob("base-*.db"))
    return todos[:-mantener] if mantener > 0 and len(todos) > mantener else []


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Respalda la base SQLite de forma consistente.")
    parser.add_argument("--destino", type=Path, default=None, help="Carpeta donde escribir.")
    parser.add_argument(
        "--mantener",
        type=int,
        default=0,
        help="Cuántos respaldos conservar (0 = todos).",
    )
    args = parser.parse_args()

    ajustes = get_settings()
    origen = db_path(ajustes)
    if not origen.exists():
        print(f"No hay base que respaldar en {origen}")
        return 1

    carpeta = args.destino or (resolve_data_dir(ajustes) / "respaldos")
    marca = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    destino = carpeta / f"base-{marca}.db"

    escrito = asyncio.run(respaldar(ajustes, destino))
    print(f"origen:  {origen}  ({origen.stat().st_size / 1e6:.1f} MB)")
    print(f"respaldo: {escrito}  ({escrito.stat().st_size / 1e6:.1f} MB)")

    for sobra in _viejos_de_mas(carpeta, args.mantener):
        sobra.unlink()
        print(f"borrado el viejo: {sobra.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
