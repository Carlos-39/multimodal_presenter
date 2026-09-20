"""Test del endpoint POST /transform con el modelo mockeado por dependency override."""

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model
from multimodal_presenter.main import app
from multimodal_presenter.schemas.transform import TransformResponse


@pytest.fixture
def client_with_mock_model(mock_presentation: dict):
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_args=mock_presentation)
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_transform_endpoint_returns_typed_envelope(client_with_mock_model, input_text: str) -> None:
    response = client_with_mock_model.post("/transform", json={"text": input_text})

    assert response.status_code == 200
    body = response.json()
    # Envelope tipado {presentation, grounding}, no un contrato pelado.
    assert "presentation" in body
    assert "grounding" in body
    assert body["grounding"]["grounded_sections"] == 2
    assert response.headers["X-Grounding-Warnings"] == "0"
    # Valida contra el contrato de respuesta.
    TransformResponse.model_validate(body)


def test_transform_endpoint_rejects_empty_text(client_with_mock_model) -> None:
    response = client_with_mock_model.post("/transform", json={"text": ""})
    assert response.status_code == 422  # min_length=1 del contrato
