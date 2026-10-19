"""Tests de la narración TTS (Hito 5g Parte 3). Mockean Sonnet (guion) y el TTS (OpenAI)."""

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model, get_settings
from multimodal_presenter.config import Settings
from multimodal_presenter.main import app
from multimodal_presenter.pipeline import narration

_FAKE_MP3 = b"ID3\x04fake-audio-bytes"


@pytest.fixture(autouse=True)
def _clear_caches():
    narration._script_cache.clear()
    narration._audio_cache.clear()
    yield
    app.dependency_overrides.clear()


def _with_tts_key():
    app.dependency_overrides[get_settings] = lambda: Settings(
        openai_api_key="sk-test", logfire_token=""
    )


def test_narracion_genera_y_devuelve_mp3(monkeypatch, mock_presentation: dict) -> None:
    _with_tts_key()
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_text="Guion narrado.")
    calls = {"tts": 0}

    async def fake_synth(settings, script):  # noqa: ANN001 (ARG001)
        calls["tts"] += 1
        return _FAKE_MP3

    monkeypatch.setattr(narration, "synthesize_speech", fake_synth)

    client = TestClient(app)
    r = client.post("/narration", json={"presentation": mock_presentation})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/mpeg"
    assert r.content == _FAKE_MP3
    assert calls["tts"] == 1


def test_narracion_usa_cache_en_segunda_peticion(monkeypatch, mock_presentation: dict) -> None:
    _with_tts_key()
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_text="Guion narrado.")
    calls = {"tts": 0}

    async def fake_synth(settings, script):  # noqa: ANN001 (ARG001)
        calls["tts"] += 1
        return _FAKE_MP3

    monkeypatch.setattr(narration, "synthesize_speech", fake_synth)

    client = TestClient(app)
    first = client.post("/narration", json={"presentation": mock_presentation})
    second = client.post("/narration", json={"presentation": mock_presentation})
    assert first.status_code == second.status_code == 200
    assert second.content == _FAKE_MP3
    assert calls["tts"] == 1  # la segunda vez NO regenera: usa caché


def test_narracion_sin_clave_es_503(mock_presentation: dict) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(openai_api_key=None, logfire_token="")
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_text="x")
    client = TestClient(app)
    r = client.post("/narration", json={"presentation": mock_presentation})
    assert r.status_code == 503  # falla visible, no reproductor mudo
