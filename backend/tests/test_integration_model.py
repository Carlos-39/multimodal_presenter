"""Tests de integración con los modelos REALES — opcionales, solo local.

No corren en CI: se saltan si no hay ANTHROPIC_API_KEY real. Para ejecutarlos:
    uv run pytest -m integration

Usan el `build_model` real: primario Anthropic (claude-sonnet-5) + fallback Gemini vía
OpenRouter. Mientras no haya claves reales configuradas, quedan escritos pero SIN CORRER
— nada se da por confirmado.
"""

import asyncio

import pytest

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_model
from multimodal_presenter.pipeline import transform
from multimodal_presenter.schemas import Presentation

_key = get_settings().anthropic_api_key
_HAS_REAL_KEY = bool(_key) and _key != "your-anthropic-api-key-here"


@pytest.mark.integration
@pytest.mark.skipif(not _HAS_REAL_KEY, reason="requiere ANTHROPIC_API_KEY real (solo local)")
def test_real_model_text() -> None:
    model = build_model(get_settings())
    result = asyncio.run(transform(model, text="La empresa creció en 2024. Ventas: 150."))
    assert isinstance(result.presentation, Presentation)
    assert len(result.presentation.sections) >= 1


@pytest.mark.integration
@pytest.mark.skipif(not _HAS_REAL_KEY, reason="requiere ANTHROPIC_API_KEY real (solo local)")
def test_real_model_pdf_native_multimodal(pdf_bytes: bytes) -> None:
    """Confirma el procesamiento multimodal nativo del PDF (Claude lo 've' sin OCR).

    Pendiente de verificación real hasta configurar claves. Usar un PDF con tablas/diagramas
    para una prueba significativa.
    """
    model = build_model(get_settings())
    result = asyncio.run(
        transform(model, binary=pdf_bytes, media_type="application/pdf", filename="d.pdf")
    )
    assert isinstance(result.presentation, Presentation)
    assert result.grounding.source_kind == "pdf"
