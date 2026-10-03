"""Cuentas (F1 de login + persistencia): registrarse, entrar, salir, y el modo invitado.

Lo que más importa de este archivo no son los casos felices, sino tres cosas:

1. **Que la aplicación siga funcionando sin cuenta.** No es una cortesía: las sesiones de
   evaluación del Hito 8 corren sin login, así que si entrar se vuelve obligatorio, el Hito 8 se
   rompe. Hay un test dedicado a eso.
2. **Que no se pueda averiguar quién tiene cuenta.** El error de entrar no distingue entre correo
   desconocido y contraseña incorrecta.
3. **Que salir revoque de verdad**, no solo borre la cookie del navegador.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from multimodal_presenter.main import app

CREDENCIALES = {"email": "carlos@ejemplo.com", "contrasena": "unaclavelarga"}


@pytest.fixture
def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Cada test con su propia base: las cuentas de uno no se ven desde otro."""
    from multimodal_presenter.config import get_settings

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    with TestClient(app) as cliente:  # el `with` dispara el ciclo de vida, que migra
        yield cliente
    get_settings.cache_clear()


# ─────────────────────────────────────────────────────────────
# Registro
# ─────────────────────────────────────────────────────────────
def test_registrarse_deja_la_sesion_abierta(client: TestClient) -> None:
    """Registrarse y tener que entrar a continuación es un paso de más."""
    r = client.post("/auth/registro", json=CREDENCIALES)
    assert r.status_code == 201
    assert r.json()["email"] == "carlos@ejemplo.com"
    assert "mmp_sesion" in r.cookies
    assert client.get("/auth/yo").status_code == 200


def test_la_respuesta_no_filtra_el_hash_ni_el_token(client: TestClient) -> None:
    """En el navegador no hacen falta, así que no salen. La cookie es `HttpOnly` aparte."""
    cuerpo = client.post("/auth/registro", json=CREDENCIALES).json()
    assert set(cuerpo) == {"id", "email"}


def test_la_cookie_es_httponly(client: TestClient) -> None:
    """Para que un XSS no pueda llevarse la sesión leyendo `document.cookie`."""
    r = client.post("/auth/registro", json=CREDENCIALES)
    cabecera = r.headers["set-cookie"].lower()
    assert "httponly" in cabecera
    assert "samesite=lax" in cabecera


def test_no_se_puede_repetir_el_correo(client: TestClient) -> None:
    client.post("/auth/registro", json=CREDENCIALES)
    r = client.post("/auth/registro", json=CREDENCIALES)
    assert r.status_code == 400
    assert "Ya existe" in r.json()["detail"]


def test_el_correo_no_distingue_mayusculas(client: TestClient) -> None:
    """Nadie espera que Carlos@x.com y carlos@x.com sean dos cuentas."""
    client.post("/auth/registro", json=CREDENCIALES)
    r = client.post("/auth/registro", json={**CREDENCIALES, "email": "CARLOS@Ejemplo.com"})
    assert r.status_code == 400


@pytest.mark.parametrize(
    "email", ["sinarroba", "sin@dominio", "@sinlocal.com", "con espacio@x.com"]
)
def test_correos_que_no_valen(client: TestClient, email: str) -> None:
    r = client.post("/auth/registro", json={**CREDENCIALES, "email": email})
    assert r.status_code == 400


def test_la_contrasena_tiene_minimo(client: TestClient) -> None:
    r = client.post("/auth/registro", json={**CREDENCIALES, "contrasena": "corta"})
    assert r.status_code == 400
    assert "8 caracteres" in r.json()["detail"]


# ─────────────────────────────────────────────────────────────
# Entrar y salir
# ─────────────────────────────────────────────────────────────
def test_entrar_con_las_credenciales_correctas(client: TestClient) -> None:
    client.post("/auth/registro", json=CREDENCIALES)
    client.post("/auth/salir")
    r = client.post("/auth/entrar", json=CREDENCIALES)
    assert r.status_code == 200
    assert client.get("/auth/yo").json()["email"] == "carlos@ejemplo.com"


def test_el_error_de_entrar_no_dice_si_el_correo_existe(client: TestClient) -> None:
    """Distinguir los dos casos permitiría averiguar quién tiene cuenta sin saber contraseñas."""
    client.post("/auth/registro", json=CREDENCIALES)
    client.post("/auth/salir")

    mal_clave = client.post("/auth/entrar", json={**CREDENCIALES, "contrasena": "otraclavelarga"})
    sin_cuenta = client.post(
        "/auth/entrar", json={"email": "nadie@ejemplo.com", "contrasena": "unaclavelarga"}
    )
    assert mal_clave.status_code == sin_cuenta.status_code == 401
    assert mal_clave.json()["detail"] == sin_cuenta.json()["detail"]


def test_salir_revoca_la_sesion_de_verdad(client: TestClient) -> None:
    """No basta con borrar la cookie: el token guardado tiene que dejar de valer.

    Se reenvía el token a mano justamente para saltarse el borrado de la cookie del navegador y
    comprobar que el servidor ya no lo acepta.
    """
    client.post("/auth/registro", json=CREDENCIALES)
    token = client.cookies["mmp_sesion"]
    client.post("/auth/salir")

    client.cookies.set("mmp_sesion", token)
    assert client.get("/auth/yo").status_code == 401


def test_salir_sin_sesion_no_es_un_error(client: TestClient) -> None:
    assert client.post("/auth/salir").status_code == 204


def test_un_token_inventado_no_entra(client: TestClient) -> None:
    client.cookies.set("mmp_sesion", "token-que-me-acabo-de-inventar")
    assert client.get("/auth/yo").status_code == 401


def test_yo_sin_sesion_es_401(client: TestClient) -> None:
    assert client.get("/auth/yo").status_code == 401


# ─────────────────────────────────────────────────────────────
# Modo invitado: el Hito 8 depende de esto
# ─────────────────────────────────────────────────────────────
def test_la_aplicacion_funciona_sin_cuenta(client: TestClient) -> None:
    """Las sesiones de evaluación corren SIN login. Si entrar se volviera obligatorio, se rompen.

    Se comprueba sobre la telemetría a propósito: es la pieza de la que depende el Hito 8, y
    tiene que seguir aceptando eventos de alguien que nunca creó una cuenta.
    """
    evento = {
        "session_id": "sesion-sin-cuenta",
        "participant": "P07",
        "name": "session_start",
        "ts": "2026-10-03T10:00:00.000Z",
        "seq": 0,
        "data": {},
    }
    assert client.post("/telemetry", json={"events": [evento]}).status_code == 204
    assert client.get("/health").status_code == 200


def test_la_telemetria_no_admite_identidad_de_cuenta(client: TestClient) -> None:
    """El consentimiento promete anonimato por Pxx: atar la telemetría a una cuenta lo rompería.

    `TelemetryEvent` es `extra="forbid"`, así que un campo `usuario_id` se rechaza por
    construcción. Este test lo fija para que siga siendo cierto cuando el login esté cableado.
    """
    evento = {
        "session_id": "s",
        "participant": "P07",
        "name": "session_start",
        "ts": "2026-10-03T10:00:00.000Z",
        "seq": 0,
        "data": {},
        "usuario_id": "usr-123",
    }
    r = client.post("/telemetry", json={"events": [evento]})
    assert r.status_code == 204, "el lote se acepta…"

    from multimodal_presenter.config import get_settings
    from multimodal_presenter.telemetry import resolve_telemetry_dir

    carpeta = resolve_telemetry_dir(get_settings())
    escritos = []
    if carpeta and carpeta.exists():
        for jsonl in carpeta.glob("ux-*.jsonl"):
            escritos += [
                ln for ln in jsonl.read_text(encoding="utf-8").splitlines() if "usr-123" in ln
            ]
    assert escritos == [], "…pero el evento con identidad de cuenta NO se escribe"
