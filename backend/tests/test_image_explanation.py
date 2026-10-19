"""Tests del endpoint POST /explain-image (Hito 5h Parte 3) con el modelo mockeado."""

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model
from multimodal_presenter.main import app

_FAKE = "La figura muestra la estructura con sus partes principales."


@pytest.fixture
def client():
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_text=_FAKE)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_explica_imagen_pdf(client, pdf_bytes: bytes) -> None:
    response = client.post(
        "/explain-image",
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
        data={"page": "2", "context": "estructura molecular"},
    )
    assert response.status_code == 200
    assert response.json()["explanation"] == _FAKE


def test_explica_imagen_png(client, png_bytes: bytes) -> None:
    response = client.post("/explain-image", files={"file": ("img.png", png_bytes, "image/png")})
    assert response.status_code == 200
    assert len(response.json()["explanation"]) > 0


def test_fuente_texto_es_400(client, input_text: str) -> None:
    # Una fuente de texto no tiene imagen real que explicar.
    assert client.post("/explain-image", data={"text": input_text}).status_code == 400


def test_los_prompts_que_se_pintan_tal_cual_prohiben_markdown():
    """El texto libre que la interfaz pinta sin tocar no puede venir en Markdown.

    No hay renderizador de Markdown en el frontend (a propósito), así que un `**así**` se ve
    escrito. Pasó con «explicar esta imagen» en producción. Este test no comprueba el estilo del
    prompt: comprueba que la regla sigue puesta en los dos sitios que la necesitan, para que
    reescribir uno de ellos no se la lleve por delante en silencio.
    """
    from multimodal_presenter.pipeline.chat import _CHAT_PROMPT
    from multimodal_presenter.pipeline.estilo import SIN_MARKDOWN
    from multimodal_presenter.pipeline.image_explanation import _SYSTEM

    assert SIN_MARKDOWN in _SYSTEM
    assert SIN_MARKDOWN in _CHAT_PROMPT
    # El marcador tiene que haberse sustituido: si quedara literal, el modelo lo leería como texto.
    assert "{SIN_MARKDOWN}" not in _CHAT_PROMPT
