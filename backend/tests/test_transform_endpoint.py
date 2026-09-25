"""Tests del endpoint POST /transform (multipart) con el modelo mockeado."""

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model
from multimodal_presenter.main import app
from multimodal_presenter.schemas.transform import TransformResponse


@pytest.fixture
def client(mock_presentation: dict):
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_args=mock_presentation)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_text_only(client, input_text: str) -> None:
    response = client.post("/transform", data={"text": input_text})
    assert response.status_code == 200
    body = response.json()
    assert "presentation" in body and "grounding" in body
    assert body["grounding"]["source_kind"] == "text"
    assert response.headers["X-Grounding-Warnings"] == "0"
    TransformResponse.model_validate(body)


def test_file_only(client, pdf_bytes: bytes) -> None:
    response = client.post("/transform", files={"file": ("doc.pdf", pdf_bytes, "application/pdf")})
    assert response.status_code == 200
    body = response.json()
    assert body["grounding"]["source_kind"] == "pdf"
    TransformResponse.model_validate(body)


def test_text_and_file_combined(client, pdf_bytes: bytes) -> None:
    response = client.post(
        "/transform",
        data={"text": "explícame esto sin asumir conocimiento"},
        files={"file": ("doc.pdf", pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200
    assert response.json()["grounding"]["source_kind"] == "pdf"


def test_neither_text_nor_file_is_400(client) -> None:
    response = client.post("/transform", data={})
    assert response.status_code == 400


def test_disallowed_file_type_is_415(client) -> None:
    response = client.post(
        "/transform", files={"file": ("x.pdf", b"no soy un pdf real", "application/pdf")}
    )
    assert response.status_code == 415
