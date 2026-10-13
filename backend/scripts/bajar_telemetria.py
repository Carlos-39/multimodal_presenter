"""Baja la telemetría del despliegue y produce los CSV de siempre.

Las dos cosas de un tirón, porque separarlas es la forma de acabar analizando un volcado de
anteayer: pide el crudo al endpoint protegido, lo guarda con fecha y llama al exportador que ya
existe. **El exportador no se toca**: es el que se usó con los datos de desarrollo y el que define
qué significa cada columna. Dos implementaciones de eso serían dos verdades.

Uso (desde backend/). **En PowerShell las variables NO se ponen delante del comando**:

    PowerShell:
        $env:TELEMETRIA_TOKEN = "..."     # el del servicio `api`
        $env:ACCESO_CODIGO    = "..."     # el del servicio `web`, para pasar el portón
        uv run python scripts/bajar_telemetria.py --url https://<tu-url> --out ../datos-sesiones

    bash:
        TELEMETRIA_TOKEN=... ACCESO_CODIGO=... uv run python scripts/bajar_telemetria.py --url ...

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


def _pasa_el_porton(cliente: httpx.Client, url: str, codigo: str | None) -> None:
    """Deja la cookie del portón en el cliente, si el despliegue tiene portón.

    **Hace falta aunque el token sea correcto**, y es la clase de detalle que cuesta una tarde:
    el portón cubre `/api/*` entero, así que sin la cookie el volcado responde 401 ANTES de que
    nadie mire el token. Pasó de verdad: el 401 del portón se leyó como «token incorrecto» y
    mandó a revisar lo que estaba bien.
    """
    if not codigo:
        return
    r = cliente.get(url.rstrip("/") + "/", params={"c": codigo}, follow_redirects=False)
    if not cliente.cookies.get("mmp_acceso"):
        raise SystemExit(
            f"El código de acceso no sirvió (respuesta {r.status_code}). "
            "Es el valor de ACCESO_CODIGO del servicio `web`."
        )


def descarga(url: str, token: str, codigo: str | None, destino: Path) -> int:
    """Guarda el volcado y devuelve cuántos eventos trae. Lanza si la respuesta no es buena."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    eventos = 0
    with httpx.Client(timeout=120, follow_redirects=False) as cliente:
        _pasa_el_porton(cliente, url, codigo)
        # El token va en una CABECERA y nunca en la URL: las URL acaban en registros de acceso, en
        # el historial y en cualquier captura de pantalla.
        with cliente.stream(
            "GET",
            url.rstrip("/") + "/api/telemetry/volcado",
            headers={"X-Telemetria-Token": token},
        ) as respuesta:
            if respuesta.status_code != 200:
                cuerpo = respuesta.read().decode("utf-8", "replace")
                # Los dos 401 posibles se distinguen por el cuerpo, no por el código: decir «token
                # incorrecto» cuando el problema es el portón manda a revisar lo que está bien.
                if "enlace de acceso" in cuerpo:
                    raise SystemExit(
                        "El portón bloqueó la petición. Pasa el código de acceso:\n"
                        "  PowerShell:  $env:ACCESO_CODIGO = '...'\n"
                        "  bash:        export ACCESO_CODIGO=...\n"
                        "Es el valor de ACCESO_CODIGO del servicio `web`."
                    )
                raise SystemExit(
                    f"El servidor respondió {respuesta.status_code}. "
                    + {
                        401: "El token de telemetría no es el que espera el despliegue "
                        "(TELEMETRIA_TOKEN del servicio `api`).",
                        404: "O no hay TELEMETRIA_TOKEN configurado allí, o aún no hay eventos.",
                    }.get(respuesta.status_code, cuerpo[:200])
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
    parser.add_argument("--codigo", default=None, help="Código del portón (o ACCESO_CODIGO).")
    args = parser.parse_args()

    token = os.environ.get("TELEMETRIA_TOKEN")
    if not token:
        raise SystemExit(
            "Falta TELEMETRIA_TOKEN en el entorno (el del servicio `api`).\n"
            "  PowerShell:  $env:TELEMETRIA_TOKEN = '...'\n"
            "  bash:        export TELEMETRIA_TOKEN=..."
        )
    codigo = args.codigo or os.environ.get("ACCESO_CODIGO")

    marca = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    crudo = args.out / f"telemetria-{marca}.jsonl"
    eventos = descarga(args.url, token, codigo, crudo)
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
