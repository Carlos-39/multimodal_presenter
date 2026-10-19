"""Topes de uso de lo que cuesta dinero.

Lo que se fija aquí, por orden de importancia:

1. **Que el tope corte ANTES de tocar el modelo.** Un tope que se comprueba después de gastar no
   es un tope. Se prueba con una entrada inválida: si el 429 gana al 400, la dependencia corrió
   antes que el cuerpo del endpoint, que es donde vive la llamada.
2. **Que las dos categorías sean independientes.** Agotar las transformaciones no puede dejar a
   nadie sin poder preguntar: en una sesión de evaluación eso sería perder los datos de la parte
   que más importa.
3. **Que se pueda apagar.** Con `0`, ningún tope.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model, get_summary_model
from multimodal_presenter.config import get_settings
from multimodal_presenter.main import app


@pytest.fixture
def _topes(tmp_path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    # Topes diminutos: lo que se prueba es la mecánica, no los números de producción.
    monkeypatch.setenv("LIMITE_GENERACION_POR_HORA", "3")
    monkeypatch.setenv("LIMITE_CONVERSACION_POR_HORA", "5")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
    app.dependency_overrides.clear()


@pytest.fixture
def client(_topes) -> TestClient:
    """Con el modelo mockeado: así una entrada inválida da el 400 del cuerpo del endpoint."""
    app.dependency_overrides[get_model] = lambda: TestModel()
    app.dependency_overrides[get_summary_model] = lambda: TestModel()
    with TestClient(app) as cliente:
        yield cliente


@pytest.fixture
def client_sin_modelo(_topes) -> TestClient:
    """SIN mockear el modelo: construirlo revienta porque no hay clave, igual que en el CI.

    Sirve para una pregunta que no se puede responder de otra forma: ¿el tope corre antes que la
    construcción del modelo? Si con el cupo agotado sale un 429 limpio en vez del error de la
    clave, es que sí.
    """
    with TestClient(app, raise_server_exceptions=False) as cliente:
        yield cliente


def _transforma(client: TestClient, **kwargs):
    """Una transformación SIN documento: el cuerpo responde 400 sin tocar el modelo."""
    return client.post("/transform", data={"text": ""}, **kwargs)


def _pregunta(client: TestClient, **kwargs):
    return client.post("/summary", data={"text": ""}, **kwargs)


def test_el_tope_corta_antes_de_llegar_al_modelo(client: TestClient) -> None:
    """Si el 429 gana al 400, la comprobación corrió antes que el cuerpo del endpoint.

    Ahí es donde tiene que estar: una vez dentro, la llamada al modelo ya está hecha y el tope
    habría costado justo lo que pretende evitar.
    """
    for _ in range(3):
        assert _transforma(client).status_code == 400

    r = _transforma(client)
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0
    assert "documentos por hora" in r.json()["detail"]


def test_agotar_las_transformaciones_no_deja_sin_preguntar(client: TestClient) -> None:
    """Son dos bolsas distintas, y mezclarlas costaría los datos de la parte que más importa."""
    for _ in range(4):
        _transforma(client)
    assert _transforma(client).status_code == 429

    # El chat sigue intacto.
    assert _pregunta(client).status_code == 400


def test_cada_categoria_lleva_su_propia_cuenta(client: TestClient) -> None:
    for _ in range(5):
        assert _pregunta(client).status_code == 400
    r = _pregunta(client)
    assert r.status_code == 429
    assert "preguntas por hora" in r.json()["detail"]


def test_con_cero_no_hay_tope(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LIMITE_GENERACION_POR_HORA", "0")
    get_settings.cache_clear()
    for _ in range(12):
        assert _transforma(client).status_code == 400


def test_sin_proxies_de_confianza_la_cabecera_no_se_mira(client: TestClient) -> None:
    """Es la parte incómoda y hay que fijarla: con `PROXIES_CONFIABLES=0` el tope NO es por
    dirección, es global, porque `x-forwarded-for` se ignora entera.

    Es lo correcto mientras no se haya medido la cadena del despliegue (creérsela a ciegas deja
    que cada quien se invente su dirección), pero significa que los números tienen que ser
    holgados hasta entonces.
    """
    for _ in range(3):
        _transforma(client, headers={"x-forwarded-for": "1.1.1.1"})
    # Otra dirección declarada, misma cuenta: la cabecera no se está mirando.
    assert _transforma(client, headers={"x-forwarded-for": "2.2.2.2"}).status_code == 429


def test_con_un_proxy_de_confianza_si_separa_por_direccion(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PROXIES_CONFIABLES", "1")
    get_settings.cache_clear()

    for _ in range(3):
        _transforma(client, headers={"x-forwarded-for": "1.1.1.1"})
    assert _transforma(client, headers={"x-forwarded-for": "1.1.1.1"}).status_code == 429
    # Otro participante, otra bolsa.
    assert _transforma(client, headers={"x-forwarded-for": "2.2.2.2"}).status_code == 400


def test_los_endpoints_que_no_cuestan_no_llevan_tope(client: TestClient) -> None:
    """El localizador de regiones es cómputo local (`pypdfium2`, sin modelo) y se llama cada vez
    que alguien abre una fuente. Ponerle tope sería cobrar por lo que es gratis."""
    for _ in range(8):
        r = client.post("/pdf-page", data={"page": "1"})
        assert r.status_code != 429
    for _ in range(8):
        assert client.get("/health").status_code == 200


def test_el_tope_gana_incluso_a_construir_el_modelo(client_sin_modelo: TestClient) -> None:
    """Sin clave, construir el modelo revienta. Si con el cupo agotado sale un 429 limpio en vez
    de ese error, el tope corrió antes: que es la única posición en la que sirve de algo."""
    for _ in range(3):
        # Revienta al construir el modelo: 500, no 429. Lo que importa es que SE CUENTAN.
        assert _transforma(client_sin_modelo).status_code == 500

    r = _transforma(client_sin_modelo)
    assert r.status_code == 429, "el tope tiene que ganarle a la construcción del modelo"
    assert "documentos por hora" in r.json()["detail"]
