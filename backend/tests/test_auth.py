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
    assert client.get("/auth/yo").json() is None, "el token revocado seguía valiendo"


def test_salir_sin_sesion_no_es_un_error(client: TestClient) -> None:
    assert client.post("/auth/salir").status_code == 204


def test_un_token_inventado_no_entra(client: TestClient) -> None:
    client.cookies.set("mmp_sesion", "token-que-me-acabo-de-inventar")
    assert client.get("/auth/yo").json() is None


def test_yo_sin_sesion_responde_que_no_hay_nadie(client: TestClient) -> None:
    """`null` y no 401: no tener cuenta es el estado NORMAL de esta aplicación, no un error.

    Con 401, cada carga sin sesión pintaba dos errores rojos en la consola del navegador por algo
    que funcionaba como debía — y un error que no lo es enseña a ignorar los que sí lo son.
    """
    respuesta = client.get("/auth/yo")
    assert respuesta.status_code == 200
    assert respuesta.json() is None


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


# ─────────────────────────────────────────────────────────────
# Límite de intentos y registro cerrado
# ─────────────────────────────────────────────────────────────
MAL = {"email": CREDENCIALES["email"], "contrasena": "claveequivocada"}


def _falla(client: TestClient, veces: int, datos: dict | None = None, **kwargs) -> None:
    for _ in range(veces):
        client.post("/auth/entrar", json=datos or MAL, **kwargs)


def test_cinco_fallos_cierran_la_puerta_un_rato(client: TestClient) -> None:
    """Contra una contraseña que alguien se tuvo que aprender, contar intentos sí sirve."""
    client.post("/auth/registro", json=CREDENCIALES)
    client.post("/auth/salir")

    _falla(client, 5)
    r = client.post("/auth/entrar", json=MAL)
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0
    # El mensaje dice cuánto falta: sin eso, quien se equivocó de verdad no sabe si esperar un
    # minuto o volver mañana.
    assert "min" in r.json()["detail"]

    # Y la puerta está cerrada también para la contraseña BUENA: si no, bastaría acertar al
    # sexto intento y el límite no limitaría nada.
    assert client.post("/auth/entrar", json=CREDENCIALES).status_code == 429


def test_acertar_antes_del_quinto_borra_el_historial(client: TestClient) -> None:
    """Quien se equivoca dos veces y entra no puede quedarse a un intento del bloqueo."""
    client.post("/auth/registro", json=CREDENCIALES)
    client.post("/auth/salir")

    _falla(client, 4)
    assert client.post("/auth/entrar", json=CREDENCIALES).status_code == 200
    client.post("/auth/salir")
    _falla(client, 4)
    assert client.post("/auth/entrar", json=CREDENCIALES).status_code == 200


def test_el_429_no_delata_si_la_cuenta_existe(client: TestClient) -> None:
    """Es la contrapartida del mensaje de error que no distingue los dos casos.

    Si solo se contaran las contraseñas falladas de cuentas existentes, el 429 aparecería SOLO con
    correos registrados y sería justo el oráculo que ese mensaje evita con tanto cuidado.
    """
    desconocido = {"email": "nadie@ejemplo.com", "contrasena": "loquesea1234"}
    _falla(client, 5, desconocido)
    r = client.post("/auth/entrar", json=desconocido)
    assert r.status_code == 429


def test_el_contador_del_correo_no_se_esquiva_cambiando_de_red(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Las dos llaves cubren ataques distintos, y la del correo es la que no se puede esquivar."""
    from multimodal_presenter.config import get_settings

    monkeypatch.setenv("PROXIES_CONFIABLES", "1")
    get_settings.cache_clear()

    client.post("/auth/registro", json=CREDENCIALES)
    client.post("/auth/salir")

    _falla(client, 5, headers={"x-forwarded-for": "1.1.1.1"})
    # Otra dirección, mismo correo: la llave del correo sigue bloqueada.
    assert (
        client.post("/auth/entrar", json=MAL, headers={"x-forwarded-for": "2.2.2.2"}).status_code
        == 429
    )
    # Otra dirección y otro correo: ninguna de las dos llaves está gastada, así que pasa.
    otro = {"email": "otra@ejemplo.com", "contrasena": "loquesea1234"}
    assert (
        client.post("/auth/entrar", json=otro, headers={"x-forwarded-for": "2.2.2.2"}).status_code
        == 401
    )


def test_cambiar_una_mayuscula_no_estrena_contador(client: TestClient) -> None:
    """El correo se normaliza igual que al guardarlo, o el límite se esquiva con un Shift."""
    _falla(client, 5)
    gritando = {"email": CREDENCIALES["email"].upper(), "contrasena": "claveequivocada"}
    assert client.post("/auth/entrar", json=gritando).status_code == 429


def test_con_el_registro_cerrado_no_se_crean_cuentas_pero_si_se_entra(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Son tres cosas distintas —registro, login y modo invitado— y se deciden por separado."""
    from multimodal_presenter.config import get_settings

    client.post("/auth/registro", json=CREDENCIALES)  # con el registro aún abierto
    client.post("/auth/salir")

    monkeypatch.setenv("REGISTRO_ABIERTO", "false")
    get_settings.cache_clear()

    r = client.post("/auth/registro", json={"email": "nuevo@ejemplo.com", "contrasena": "12345678"})
    assert r.status_code == 403
    assert "cerrado" in r.json()["detail"]

    # Entrar sigue funcionando, y el modo invitado tampoco se toca.
    assert client.post("/auth/entrar", json=CREDENCIALES).status_code == 200
    client.post("/auth/salir")
    assert client.get("/auth/yo").json() is None


def test_preguntar_por_correos_ajenos_tambien_se_corta(client: TestClient) -> None:
    """«Ese correo ya está registrado» es un oráculo de quién tiene cuenta. Con límite, se puede
    preguntar por cinco correos cada cuarto de hora en vez de por una lista entera."""
    client.post("/auth/registro", json=CREDENCIALES)
    for _ in range(5):
        r = client.post("/auth/registro", json=CREDENCIALES)
        assert r.status_code == 400
    assert client.post("/auth/registro", json=CREDENCIALES).status_code == 429


def test_el_formulario_puede_preguntar_si_hay_registro(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Para no ofrecer una puerta cerrada. La verdad sigue viviendo en un solo sitio: el ajuste
    del backend, en vez de una variable pública duplicada en el frontend."""
    from multimodal_presenter.config import get_settings

    r = client.get("/auth/estado")
    assert r.status_code == 200
    assert r.json() == {"registro_abierto": True}

    monkeypatch.setenv("REGISTRO_ABIERTO", "false")
    get_settings.cache_clear()
    assert client.get("/auth/estado").json() == {"registro_abierto": False}


def test_preguntar_por_el_estado_no_exige_sesion_ni_cuenta_nada(client: TestClient) -> None:
    """Dice si una puerta está abierta: es información del servicio, no de ninguna persona."""
    for _ in range(10):
        assert client.get("/auth/estado").status_code == 200
