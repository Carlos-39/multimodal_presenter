"""El workflow de CI tiene que poder leerse.

Existe por un fallo que no avisa de ninguna manera. Un cambio de puntuación dejó un `: ` dentro de
un valor sin comillas, que en YAML es un error de sintaxis, y GitHub no ejecutó nada. No falló una
comprobación: no hubo comprobaciones. El commit entró en `main` con todo en verde porque no había
nada que ponerse en rojo.

Un test del backend no puede salvarnos en GitHub (si el workflow no se parsea, este test tampoco
llega a correr allí), pero sí aquí, que es donde paso la suite antes de subir. Esa es la ventana
en la que se caza esto.
"""

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml", reason="PyYAML llega con el grupo de desarrollo")

WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "ci.yml"


def _cargado() -> dict:
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def test_el_workflow_se_parsea() -> None:
    assert WORKFLOW.is_file(), f"no está {WORKFLOW}"
    assert isinstance(_cargado(), dict)


def test_corre_en_main_y_en_develop() -> None:
    """`on` lo lee PyYAML como el booleano True, que es un clásico de YAML 1.1."""
    datos = _cargado()
    disparadores = datos.get("on", datos.get(True))
    assert disparadores, "el workflow no declara cuándo corre"
    for evento in ("push", "pull_request"):
        assert set(disparadores[evento]["branches"]) >= {"main", "develop"}


def test_estan_los_dos_trabajos_con_sus_pasos() -> None:
    """Que el frontend siga mirándose. Se quedó fuera del CI hasta hace nada."""
    trabajos = _cargado()["jobs"]
    assert set(trabajos) == {"frontend", "backend"}
    for nombre, trabajo in trabajos.items():
        assert trabajo["steps"], f"{nombre} no tiene pasos"
        assert isinstance(trabajo["name"], str) and trabajo["name"].strip()
