"""Tests de la presentación generada en diapositivas (/deck), con Sonnet e imagen mockeados."""

import json

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model, get_settings
from multimodal_presenter.config import Settings
from multimodal_presenter.main import app
from multimodal_presenter.pipeline import deck
from multimodal_presenter.schemas.presentation import ILLUSTRATION_LABEL

_FAKE_IMG = "data:image/png;base64,FAKEDECKIMG"


@pytest.fixture(autouse=True)
def _clear():
    deck._cache.clear()
    yield
    app.dependency_overrides.clear()


def _deck_model(input_text: str) -> TestModel:
    # Slide 0: anclada a una cita EXACTA del input_text → verified. Slide 1: síntesis + imagen.
    quote = "La empresa creció de forma sostenida durante la última década."
    assert quote in input_text
    payload = {
        "slides": [
            {"title": "Crecimiento", "bullets": ["Creció una década"], "source_quote": quote},
            {
                "title": "Idea simplificada",
                "bullets": ["Resumen visual"],
                "source_quote": None,
                "synthesis": True,
                "image_prompt": "diagrama del proceso",
            },
        ]
    }
    return TestModel(custom_output_text=json.dumps(payload))


def test_deck_mix_trazabilidad_y_imagen(monkeypatch, input_text: str) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        openai_api_key="sk-test", logfire_token=""
    )
    app.dependency_overrides[get_model] = lambda: _deck_model(input_text)

    async def fake_image(settings, prompt):  # noqa: ANN001 (ARG001)
        return _FAKE_IMG

    monkeypatch.setattr(deck, "_generate_image", fake_image)

    client = TestClient(app)
    r = client.post("/deck", data={"text": input_text})
    assert r.status_code == 200
    slides = r.json()["slides"]
    assert len(slides) == 2

    # Slide 0: anclada a la fuente (verified), no es síntesis, sin imagen.
    assert slides[0]["is_synthesis"] is False
    assert slides[0]["grounding"] == "verified"
    assert slides[0]["source"] is not None

    # Slide 1: síntesis declarada (sin cita) + imagen con etiqueta obligatoria.
    assert slides[1]["is_synthesis"] is True
    assert slides[1]["source"] is None
    assert slides[1]["illustration"]["image_url"] == _FAKE_IMG
    assert slides[1]["illustration"]["label"] == ILLUSTRATION_LABEL


def test_deck_sin_clave_openai_genera_sin_imagenes(monkeypatch, input_text: str) -> None:
    # Sin NINGÚN proveedor de imagen: el deck degrada sin imágenes. Se anulan las TRES claves
    # explícitamente (Gemini es el primario) para no depender del `.env` real de la máquina.
    app.dependency_overrides[get_settings] = lambda: Settings(
        google_api_key=None, openai_api_key=None, ideogram_api_key=None, logfire_token=""
    )
    app.dependency_overrides[get_model] = lambda: _deck_model(input_text)

    async def boom(settings, prompt):  # noqa: ANN001 (ARG001)
        raise AssertionError("no debe generar imagen sin clave")

    monkeypatch.setattr(deck, "_generate_image", boom)

    client = TestClient(app)
    r = client.post("/deck", data={"text": input_text})
    assert r.status_code == 200  # degrada honestamente: deck sin imágenes
    slides = r.json()["slides"]
    assert all(s["illustration"] is None for s in slides)


def test_deck_sobre_audio_lleva_el_momento_de_la_cita(wav_bytes: bytes) -> None:
    """El deck transporta `start_s` igual que las secciones y el chat.

    Sin esto, abrir la fuente desde una diapositiva de un documento de audio arrancaba el
    reproductor en 0:00 en vez de en la cita: la misma fuente se comportaba distinto según la
    vista. También cubre la rama de SÍNTESIS, donde no hay cita y `start_s` debe quedar en None
    (si no se inicializara, esa rama reventaría).
    """
    import asyncio

    from multimodal_presenter.config import get_settings as _get_settings
    from multimodal_presenter.pipeline.extraction import prepare_input
    from multimodal_presenter.schemas.audio import AudioEvidence

    cita = "las ventas subieron un veinte por ciento"
    evidencia = AudioEvidence.model_validate(
        {
            "segments": [
                {
                    "speaker": "hablante 1",
                    "text": cita,
                    "start_s": 4.5,
                    "end_s": 9.0,
                    "emphasis": [],
                    "delivery": "neutro",
                    "pause_before": "ninguna",
                    "confidence": "alta",
                }
            ],
            "non_verbal_events": [],
            "acoustic_context": {
                "quality": "clara",
                "background_noise": "",
                "intelligibility_risk": False,
                "at_risk_items": [],
            },
            "speaker_count": 1,
            "perceived_structure": [],
            "language": "es",
        }
    )
    payload = {
        "slides": [
            {"title": "Con cita", "bullets": ["x"], "source_quote": cita, "synthesis": False},
            {"title": "Síntesis", "bullets": ["y"], "source_quote": None, "synthesis": True},
        ]
    }
    extraction = prepare_input(binary=wav_bytes, media_type="audio/wav", audio_evidence=evidencia)
    ajustes = _get_settings().model_copy(
        update={"google_api_key": None, "ideogram_api_key": None, "openai_api_key": None}
    )
    resultado = asyncio.run(
        deck.generate_deck(TestModel(custom_output_text=json.dumps(payload)), ajustes, extraction)
    )

    anclada, sintesis = resultado.slides
    assert anclada.grounding == "unverified"  # audio: se localiza, no se verifica
    assert anclada.start_s == 4.5
    assert sintesis.is_synthesis is True
    assert sintesis.start_s is None
