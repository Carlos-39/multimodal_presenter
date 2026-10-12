"""Tests del endpoint POST /summary (adelanto inicial, Hito 5g) con el modelo mockeado."""

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_summary_model
from multimodal_presenter.main import app

_FAKE = "Un informe sobre el tema del documento y su propósito."


@pytest.fixture
def client():
    app.dependency_overrides[get_summary_model] = lambda: TestModel(custom_output_text=_FAKE)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_summary_desde_texto(client, input_text: str) -> None:
    response = client.post("/summary", data={"text": input_text})
    assert response.status_code == 200
    assert response.json()["summary"] == _FAKE


def test_summary_desde_pdf(client, pdf_bytes: bytes) -> None:
    response = client.post("/summary", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")})
    assert response.status_code == 200
    assert len(response.json()["summary"]) > 0


def test_summary_sin_entrada_es_400(client) -> None:
    assert client.post("/summary", data={}).status_code == 400
