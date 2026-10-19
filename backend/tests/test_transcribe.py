"""Tests del endpoint POST /transcribe (entrada por voz) con el proveedor mockeado."""

import pytest
from fastapi.testclient import TestClient

from multimodal_presenter.api import routes
from multimodal_presenter.api.routes import get_settings
from multimodal_presenter.config import Settings
from multimodal_presenter.main import app


@pytest.fixture(autouse=True)
def _clear():
    yield
    app.dependency_overrides.clear()


def test_transcribe_devuelve_texto(monkeypatch) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        openai_api_key="sk-test", logfire_token=""
    )

    async def fake(settings, audio, filename):  # noqa: ANN001 (ARG001)
        return "¿cuál fue la utilidad en 2024?"

    monkeypatch.setattr(routes, "transcribe_audio", fake)

    client = TestClient(app)
    r = client.post("/transcribe", files={"file": ("q.webm", b"fake-audio", "audio/webm")})
    assert r.status_code == 200
    assert r.json()["text"] == "¿cuál fue la utilidad en 2024?"


def test_sin_clave_es_503() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(openai_api_key=None, logfire_token="")
    client = TestClient(app)
    r = client.post("/transcribe", files={"file": ("q.webm", b"fake-audio", "audio/webm")})
    assert r.status_code == 503


def test_audio_vacio_es_400() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        openai_api_key="sk-test", logfire_token=""
    )
    client = TestClient(app)
    r = client.post("/transcribe", files={"file": ("q.webm", b"", "audio/webm")})
    assert r.status_code == 400
