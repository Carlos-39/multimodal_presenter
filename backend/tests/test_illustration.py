"""Tests de las ilustraciones de apoyo generadas (Hito 5h Parte 1), con Haiku e imagen mockeados."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_settings, get_summary_model
from multimodal_presenter.config import Settings
from multimodal_presenter.main import app
from multimodal_presenter.pipeline import illustration
from multimodal_presenter.schemas.presentation import ILLUSTRATION_LABEL

_FAKE_IMG = "data:image/png;base64,FAKEIMAGEDATA"


@pytest.fixture(autouse=True)
def _clear():
    illustration._cache.clear()
    yield
    app.dependency_overrides.clear()


def _plan_model(section_id: str) -> TestModel:
    payload = {"items": [{"section_id": section_id, "image_prompt": "diagrama del proceso"}]}
    return TestModel(custom_output_text=json.dumps(payload))


def test_genera_ilustracion_con_etiqueta(monkeypatch, mock_presentation: dict) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        openai_api_key="sk-test", logfire_token=""
    )
    app.dependency_overrides[get_summary_model] = lambda: _plan_model("s1")

    async def fake_image(settings, prompt):  # noqa: ANN001, ARG001
        return _FAKE_IMG

    monkeypatch.setattr(illustration, "_generate_image", fake_image)

    client = TestClient(app)
    r = client.post("/illustrations", json={"presentation": mock_presentation})
    assert r.status_code == 200
    items = r.json()["illustrations"]
    assert len(items) == 1
    assert items[0]["section_id"] == "s1"
    ill = items[0]["illustration"]
    assert ill["image_url"] == _FAKE_IMG
    assert ill["label"] == ILLUSTRATION_LABEL  # etiqueta obligatoria presente
    assert "source" not in ill  # estructuralmente sin fuente/grounding


def test_sin_clave_es_503(mock_presentation: dict) -> None:
    # Sin NINGÚN proveedor de imagen. Se anulan los TRES explícitamente (Gemini es el primario
    # desde el diagnóstico del texto en imágenes) para no depender del `.env` real de la máquina.
    app.dependency_overrides[get_settings] = lambda: Settings(
        google_api_key=None, openai_api_key=None, ideogram_api_key=None, logfire_token=""
    )
    app.dependency_overrides[get_summary_model] = lambda: _plan_model("s1")
    client = TestClient(app)
    r = client.post("/illustrations", json={"presentation": mock_presentation})
    assert r.status_code == 503


def test_ninguna_califica_lista_vacia(monkeypatch, mock_presentation: dict) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        openai_api_key="sk-test", logfire_token=""
    )
    # El clasificador no marca ninguna sección.
    app.dependency_overrides[get_summary_model] = lambda: TestModel(
        custom_output_text=json.dumps({"items": []})
    )

    async def fake_image(settings, prompt):  # noqa: ANN001, ARG001
        raise AssertionError("no debería generar imagen si nada califica")

    monkeypatch.setattr(illustration, "_generate_image", fake_image)

    client = TestClient(app)
    r = client.post("/illustrations", json={"presentation": mock_presentation})
    assert r.status_code == 200
    assert r.json()["illustrations"] == []


@pytest.mark.parametrize(
    "url",
    [
        "http://cdn.ideogram.ai/a.png",  # sin cifrar
        "https://169.254.169.254/latest/meta-data/",  # metadatos de la nube
        "https://127.0.0.1/a.png",
        "https://[::1]/a.png",
        "https://localhost/a.png",  # un nombre sin puntos es la red de dentro
        "https://backend.railway.internal:8000/health",
        "file:///etc/passwd",
    ],
)
def test_no_se_descarga_cualquier_url_que_diga_el_proveedor(url: str) -> None:
    """Es la única petición saliente cuyo destino no está escrito en el código: la devuelve el
    proveedor y el servidor se trae lo que haya ahí. Eso es la forma de un SSRF."""
    with pytest.raises(RuntimeError, match="no es descargable"):
        illustration._url_descargable(url)


def test_una_url_normal_del_proveedor_si_se_descarga() -> None:
    """Y no se comprueba el dominio a propósito: un allowlist se rompería en silencio el día que
    cambien de CDN, dejando sin ilustraciones por una medida de seguridad."""
    url = "https://ideogram.ai/api/images/direct/abc123.png"
    assert illustration._url_descargable(url) == url
    assert illustration._url_descargable("https://cdn.otro-proveedor.com/x.png")
