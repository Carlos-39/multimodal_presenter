"""Baja la telemetría del despliegue y produce los CSV de siempre.

Las dos cosas de un tirón, porque separarlas es la forma de acabar analizando un volcado de
anteayer: pide el crudo al endpoint protegido, lo guarda con fecha y llama al exportador que ya
existe. **El exportador no se toca**: es el que se usó con los datos de desarrollo y el que define
qué significa cada columna. Dos implementaciones de eso serían dos verdades.

Uso (desde backend/):
    TELEMETRIA_TOKEN=... uv run python scripts/bajar_telemetria.py --url https://<tu-url>
    ... --out ../datos-sesiones        # dónde dejarlo todo

Lo que deja:
    <out>/telemetria-YYYYMMDDTHHMMSSZ.jsonl   el crudo tal cual, que es el respaldo
    <out>/telemetry_summary.csv              una fila por sesión
    <out>/telemetry_raw.csv                  un evento por fila
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx


def descarga(url: str, token: str, destino: Path) -> int:
    """Guarda el volcado y devuelve cuántos eventos trae. Lanza si la respuesta no es buena."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    eventos = 0
    # El token va en una CABECERA y nunca en la URL: las URL acaban en registros de acceso, en el
    # historial y en cualquier captura de pantalla.
    with httpx.stream(
        "GET",
        url.rstrip("/") + "/api/telemetry/volcado",
        headers={"X-Telemetria-Token": token},
        timeout=120,
        follow_redirects=False,
    ) as respuesta:
        if respuesta.status_code != 200:
            respuesta.read()
            raise SystemExit(
                f"El servidor respondió {respuesta.status_code}. "
                + {
                    401: "El token no es el que espera el despliegue.",
                    404: "O no hay TELEMETRIA_TOKEN configurado allí, o todavía no hay eventos.",
                    303: "Hay portón: esta URL pide código de acceso antes que nada.",
                }.get(respuesta.status_code, "")
            )
        with destino.open("wb") as handle:
            for trozo in respuesta.iter_bytes():
                handle.write(trozo)
                eventos += trozo.count(b"\n")
    return eventos


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Baja la telemetría del despliegue y la exporta.")
    parser.add_argument("--url", required=True, help="URL pública, p. ej. https://algo.app")
    parser.add_argument("--out", type=Path, default=Path("telemetria"), help="Carpeta de salida.")
    parser.add_argument("--solo-bajar", action="store_true", help="No generar los CSV.")
    args = parser.parse_args()

    token = os.environ.get("TELEMETRIA_TOKEN")
    if not token:
        raise SystemExit("Falta TELEMETRIA_TOKEN en el entorno (el mismo que puse en la consola).")

    marca = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    crudo = args.out / f"telemetria-{marca}.jsonl"
    eventos = descarga(args.url, token, crudo)
    print(f"bajado: {crudo}  ({eventos} eventos, {crudo.stat().st_size / 1024:.1f} KB)")

    if args.solo_bajar:
        return 0
    if eventos == 0:
        print("No hay eventos todavía: no se generan CSV.")
        return 0

    # El exportador espera una CARPETA con archivos `ux-*.jsonl`, así que se le da el nombre que
    # busca en vez de cambiarlo a él.
    carpeta = args.out / f"crudo-{marca}"
    carpeta.mkdir(parents=True, exist_ok=True)
    (carpeta / f"ux-{marca}.jsonl").write_bytes(crudo.read_bytes())

    exportador = Path(__file__).with_name("export_telemetry.py")
    subprocess.run(  # noqa: S603  (ruta fija, sin entrada del usuario)
        [sys.executable, str(exportador), "--dir", str(carpeta), "--out", str(args.out)],
        check=True,
    )
    print(f"CSV en: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
