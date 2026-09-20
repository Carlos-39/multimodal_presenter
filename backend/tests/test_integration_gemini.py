"""Test de integración con Gemini REAL — opcional, solo local.

No corre en CI: se salta si no hay GEMINI_API_KEY configurada. Para ejecutarlo:
    uv run pytest -m integration
"""

import asyncio

import pytest

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_google_model
from multimodal_presenter.pipeline import transform
from multimodal_presenter.schemas import Presentation

# Solo con una clave REAL (no el placeholder de .env.example) tiene sentido correrlo.
_key = get_settings().gemini_api_key
_HAS_REAL_KEY = bool(_key) and _key != "your-gemini-api-key-here"


@pytest.mark.integration
@pytest.mark.skipif(not _HAS_REAL_KEY, reason="requiere GEMINI_API_KEY real (solo local)")
def test_real_gemini_produces_valid_presentation(input_text: str) -> None:
    model = build_google_model(get_settings())
    result = asyncio.run(transform(input_text, model=model))

    assert isinstance(result.presentation, Presentation)
    assert len(result.presentation.sections) >= 1
