"""A3 (Hito 5f) — Fallos reales de punta a punta: qué VE el usuario cuando algo falla.

Criterio (mismo principio que `not_found` en 5c y el corte de stream en 5d): nunca una
presentación silenciosamente incompleta que PAREZCA terminada. Ante cualquier fallo, el usuario
debe ver un error explícito (evento SSE `error`), no un `done` sobre datos a medias.

Casi todo se prueba con fakes (0 tokens). Solo la key inválida hace un 401 real (marcado
`integration`), que no genera tokens.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.providers.anthropic import AnthropicProvider

from multimodal_presenter.api.routes import get_model
from multimodal_presenter.config import get_settings
from multimodal_presenter.main import app
from multimodal_presenter.model_provider import build_model
from multimodal_presenter.pipeline import streaming


def _sse(input_text: str) -> str:
    """Corre /transform/stream y devuelve el cuerpo SSE crudo."""
    client = TestClient(app)
    response = client.post("/transform/stream", data={"text": input_text})
    assert response.status_code == 200  # la validación de entrada pasó; el fallo es del modelo
    return response.text


# ── A3.1a — Clave AUSENTE: el pipeline no arranca en silencio (sin red) ──
def test_a3_absent_key_raises_clear_error() -> None:
    settings = get_settings().model_copy(update={"anthropic_api_key": ""})
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        build_model(settings)


# ── A3.2 — Fallo A MITAD del stream: secciones parciales + error, nunca 'done' ──
def test_a3_midstream_failure_surfaces_error(monkeypatch, input_text: str) -> None:
    """Simula un corte tras emitir contenido: el usuario ve error, no una presentación 'lista'."""
    two_sections = {
        "title": "t",
        "sections": [
            {
                "id": "s1",
                "role": "core",
                "source": {"document_id": "d", "quote": "La empresa creció"},
                "content": {"content_type": "text", "text": "creció"},
            },
            {
                "id": "s2",
                "role": "satellite",
                "source": {"document_id": "d", "quote": "En 2023 las ventas fueron 100"},
                "content": {"content_type": "text", "text": "ventas"},
            },
        ],
    }
    import json

    app.dependency_overrides[get_model] = lambda: TestModel(
        custom_output_text=json.dumps(two_sections)
    )
    # Falla en la Fase 3 por sección al procesar la 2ª (corte tras entregar contenido).
    real_ground = streaming.ground_section
    calls = {"n": 0}

    def failing_ground(section, extraction):
        calls["n"] += 1
        if calls["n"] >= 2:
            raise RuntimeError("simulated provider drop mid-stream")
        return real_ground(section, extraction)

    monkeypatch.setattr(streaming, "ground_section", failing_ground)
    try:
        body = _sse(input_text)
    finally:
        app.dependency_overrides.clear()

    assert '"type":"section"' in body, "debería haber emitido al menos una sección antes del fallo"
    assert '"type":"error"' in body, "el fallo a mitad debe surfacear un evento error"
    assert '"type":"done"' not in body, "NUNCA un 'done' tras un fallo (parecería terminado)"


# ── A3.3 — Salida que NO valida tras reintentos: error, no un 'done' vacío ──
def test_a3_invalid_output_surfaces_error(input_text: str) -> None:
    app.dependency_overrides[get_model] = lambda: TestModel(
        custom_output_text="esto no es un JSON que valide contra el contrato"
    )
    try:
        body = _sse(input_text)
    finally:
        app.dependency_overrides.clear()

    assert '"type":"error"' in body
    assert '"type":"done"' not in body


# ── A3.1b — Clave INVÁLIDA: 401 real → el usuario ve error (0 tokens de generación) ──
@pytest.mark.integration
def test_a3_invalid_key_surfaces_error(input_text: str) -> None:
    bad = AnthropicModel(
        "claude-sonnet-5", provider=AnthropicProvider(api_key="sk-ant-invalid-000")
    )
    app.dependency_overrides[get_model] = lambda: bad
    try:
        body = _sse(input_text)
    finally:
        app.dependency_overrides.clear()

    assert '"type":"error"' in body
    assert '"type":"done"' not in body
