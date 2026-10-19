"""Lo que el código necesita tiene que estar DECLARADO, no llegar de rebote.

Este archivo existe por un fallo concreto que solo apareció al desplegar, y que conviene contar
entero porque la forma del error es la lección:

El visor de página dibuja el PDF con `render_pagina`, que convierte el bitmap de pypdfium2 a PNG
con `bitmap.to_pil()`. Eso necesita **Pillow**. Pillow no estaba declarada en ninguna parte: llegaba
arrastrada por `matplotlib`, que es dependencia de DESARROLLO. Así que en mi máquina funcionaba, en
el CI funcionaba (porque instala el grupo dev) y en la imagen de producción, que se instala con
`--no-dev`, el endpoint respondía 502 «No se pudo dibujar la página».

Lo peor no es el fallo: es que era invisible para todas las comprobaciones que teníamos. Los 330
tests pasaban. Por eso el arreglo no es solo añadir Pillow, sino dejar aquí el centinela y, en el
CI, un paso que monta el entorno de producción de verdad y comprueba que puede dibujar.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

PYPROJECT = Path(__file__).resolve().parents[1] / "pyproject.toml"


def _dependencias_declaradas() -> set[str]:
    """Los nombres de `[project.dependencies]`, sin marcadores ni versiones."""
    datos = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    nombres = set()
    for linea in datos["project"]["dependencies"]:
        nombre = linea.split(";")[0].split("[")[0]
        for corte in (">=", "==", "<=", "~=", ">", "<", "!="):
            nombre = nombre.split(corte)[0]
        nombres.add(nombre.strip().lower().replace("_", "-"))
    return nombres


def test_pillow_esta_declarada_donde_se_usa() -> None:
    """`render_pagina` la necesita, así que es dependencia de producción y no de desarrollo.

    Si alguien la quita de aquí porque «no se importa en ningún sitio», el visor de página vuelve
    a responder 502 en el despliegue y los tests seguirán todos en verde. De ahí este centinela:
    el uso es indirecto (a través de `to_pil()` de pypdfium2) y por eso no lo caza ningún análisis
    de imports.
    """
    assert "pillow" in _dependencias_declaradas(), (
        "Pillow no está en [project.dependencies]. `render_pagina` la usa a través de "
        "`bitmap.to_pil()`; sin declararla, la imagen de producción se construye sin ella."
    )


def test_el_grupo_de_desarrollo_no_sostiene_a_produccion() -> None:
    """Ninguna dependencia de producción puede estar SOLO en el grupo dev.

    Es la forma general del mismo fallo: algo que el código usa y que solo existe en la máquina
    de quien desarrolla. Aquí se comprueba al revés de lo obvio (que los paquetes pesados de
    desarrollo NO sean necesarios para servir), porque son los que arrastran cosas sin querer.
    """
    datos = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    dev = " ".join(datos["dependency-groups"]["dev"]).lower()
    produccion = _dependencias_declaradas()

    # matplotlib es quien arrastraba Pillow. Que siga siendo solo de desarrollo es correcto;
    # lo que no puede volver a pasar es que producción dependa de eso.
    assert "matplotlib" in dev
    assert "matplotlib" not in produccion
    assert "fpdf2" not in produccion, "fpdf2 genera PDF en los tests, no en el servicio"
