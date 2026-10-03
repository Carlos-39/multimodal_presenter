"""Sin cuenta la aplicación sigue siendo la aplicación (F5), y la telemetría no sabe quién eres.

Dos promesas que el login podría romper sin que nadie se diera cuenta, y que por eso se comprueban
en vez de confiarse:

1. **Entrar es opcional.** Las sesiones de evaluación del Hito 8 corren SIN login: si la aplicación
   acabara exigiendo cuenta para transformar, preguntar o generar, el Hito 8 se rompe. Añadir la
   dependencia de usuario a un endpoint es un cambio de una línea y no se nota al probar a mano,
   porque quien prueba suele estar dentro.

2. **La telemetría no lleva identidad de cuenta.** El consentimiento informado dice que la
   participación es anónima por `Pxx`. Atarla a una cuenta la volvería identificable y
   contradiría lo ya prometido a quien firmó.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from multimodal_presenter.main import app

# Lo ÚNICO que puede exigir cuenta. Si esta lista crece, que sea una decisión y no un descuido:
# el test obliga a venir aquí y escribirlo.
EXIGEN_CUENTA = {
    "/biblioteca/presentaciones",
    "/biblioteca/presentaciones/{presentacion_id}",
    "/biblioteca/presentaciones/{presentacion_id}/chat",
    "/biblioteca/presentaciones/{presentacion_id}/artefactos/deck",
    "/biblioteca/presentaciones/{presentacion_id}/artefactos/narracion",
    "/biblioteca/documentos/{document_id}",
}


def _rutas(router) -> list[APIRoute]:
    """Todas las rutas, entrando en los routers incluidos.

    `app.routes` no las trae planas: cada `include_router` deja un envoltorio que guarda el router
    original dentro. Recorrerlo a mano es lo que permite mirar las dependencias de cada endpoint.
    """
    encontradas: list[APIRoute] = []
    for r in getattr(router, "routes", []):
        if isinstance(r, APIRoute):
            encontradas.append(r)
        elif hasattr(r, "original_router"):
            encontradas.extend(_rutas(r.original_router))
    return encontradas


def _exige_cuenta(route: APIRoute) -> bool:
    """¿Alguna dependencia de esta ruta es la que corta el paso sin sesión?"""
    from multimodal_presenter.api.auth import usuario_actual

    pendientes = list(route.dependant.dependencies)
    while pendientes:
        dep = pendientes.pop()
        if dep.call is usuario_actual:
            return True
        pendientes.extend(dep.dependencies)
    return False


def test_solo_la_biblioteca_exige_cuenta() -> None:
    """Transformar, preguntar, generar y verificar NO pueden pedir login.

    Se mira el árbol de dependencias y no las respuestas: una ruta que pidiera cuenta sin querer
    devolvería 401 solo cuando alguien la probara sin sesión, y quien prueba suele estar dentro.
    """
    cerradas = {r.path for r in _rutas(app) if _exige_cuenta(r)}
    assert cerradas == EXIGEN_CUENTA, (
        "cambió qué endpoints exigen cuenta; si es a propósito, actualiza EXIGEN_CUENTA"
    )


def test_el_documento_entra_por_un_solo_sitio_y_ese_sitio_admite_invitados() -> None:
    """El punto único por el que entra un documento acepta a quien no tiene cuenta.

    Es la otra mitad de lo anterior: aunque ninguna ruta exija sesión, bastaría que el parser
    común la exigiera para cerrarlas todas de golpe.
    """
    import asyncio

    from multimodal_presenter.api.routes import parse_document_inputs
    from multimodal_presenter.config import get_settings

    texto, binario, _media, _nombre = asyncio.run(
        parse_document_inputs(
            "Los duendes rojos ocurren sobre las tormentas.", None, get_settings()
        )
    )
    assert texto and binario is None


# ─────────────────────────────────────────────────────────────
# La telemetría no sabe quién eres
# ─────────────────────────────────────────────────────────────
def test_la_ingesta_de_telemetria_no_tiene_forma_de_saber_quien_eres() -> None:
    """No es que no use la sesión: es que no la recibe.

    `TelemetryEvent` es `extra="forbid"`, así que un campo `user_id` ya sería rechazado. Esto cubre
    el otro lado: que el endpoint no pueda meterlo él, porque no tiene de dónde sacarlo.
    """
    (ruta,) = [r for r in _rutas(app) if r.path == "/telemetry"]

    from multimodal_presenter.api.auth import usuario_actual, usuario_opcional

    dependencias = {d.call for d in ruta.dependant.dependencies}
    assert usuario_actual not in dependencias
    assert usuario_opcional not in dependencias


def test_la_telemetria_no_importa_la_capa_de_cuentas() -> None:
    """Lo que no se importa no se puede colar por descuido más adelante.

    Mismo criterio que blinda al localizador de PDF frente al LLM: una barrera que se comprueba
    leyendo el módulo, no recordándola.
    """
    raiz = Path(__file__).resolve().parents[1] / "src" / "multimodal_presenter"
    prohibidos = ("storage", "users", "auth", "library", "presentations")
    for archivo in (raiz / "telemetry.py", raiz / "schemas" / "telemetry.py"):
        # Solo las líneas de import: la prosa de los docstrings habla de "el usuario" en el
        # sentido de quien usa la aplicación, que no es una dependencia de nada.
        imports = [
            linea
            for linea in archivo.read_text(encoding="utf-8").splitlines()
            if linea.startswith(("import ", "from "))
        ]
        for linea in imports:
            assert not any(modulo in linea for modulo in prohibidos), (
                f"{archivo.name} importa la capa de cuentas: {linea}"
            )


@pytest.fixture
def cliente_con_telemetria(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from multimodal_presenter.config import get_settings

    monkeypatch.setenv("DATA_DIR", str(tmp_path / "datos"))
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "ux"))
    monkeypatch.setenv("TELEMETRY_ENABLED", "true")
    get_settings.cache_clear()
    with TestClient(app) as cliente:
        yield cliente, tmp_path / "ux"
    get_settings.cache_clear()


def test_estar_dentro_no_deja_rastro_en_la_telemetria(cliente_con_telemetria) -> None:
    """La prueba de verdad: con sesión abierta, lo que se escribe a disco no permite saber de quién.

    El consentimiento promete anonimato por `Pxx`. Si el correo o el id de la cuenta acabaran en
    el JSONL, lo prometido dejaría de ser cierto para quien ya firmó.
    """
    cliente, carpeta_ux = cliente_con_telemetria

    correo = "participante.identificable@ejemplo.com"
    registro = cliente.post("/auth/registro", json={"email": correo, "contrasena": "unaclavelarga"})
    assert registro.status_code == 201
    usuario_id = registro.json()["id"]

    evento = {
        "session_id": "s-1",
        "participant": "P07",
        "name": "transform_submit",
        "ts": "2026-10-03T12:00:00Z",
        "seq": 0,
        "data": {"source_kind": "text"},
    }
    assert cliente.post("/telemetry", json={"events": [evento]}).status_code == 204

    (archivo,) = list(carpeta_ux.glob("ux-*.jsonl"))
    lineas = archivo.read_text(encoding="utf-8").strip().splitlines()
    assert len(lineas) == 1

    crudo = lineas[0]
    assert correo not in crudo
    assert usuario_id not in crudo
    # Y lo que SÍ debe estar: el participante que fijó el facilitador, que es la identidad del
    # estudio y la única que el consentimiento contempla.
    assert json.loads(crudo)["participant"] == "P07"


def test_un_evento_con_identidad_de_cuenta_se_rechaza(cliente_con_telemetria) -> None:
    """Aunque alguien lo mandara a mano. `extra="forbid"` lo convierte en imposible, no en feo."""
    cliente, carpeta_ux = cliente_con_telemetria

    evento = {
        "session_id": "s-1",
        "participant": "P07",
        "name": "session_start",
        "ts": "2026-10-03T12:00:00Z",
        "seq": 0,
        "data": {},
        "user_id": "usr-123",
    }
    # 204 porque la ingesta nunca bloquea al frontend, pero el evento se descarta: no se escribe.
    assert cliente.post("/telemetry", json={"events": [evento]}).status_code == 204
    assert not list(carpeta_ux.glob("ux-*.jsonl")), (
        "un evento con identidad de cuenta llegó a disco"
    )
