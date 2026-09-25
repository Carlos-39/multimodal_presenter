"""Tests de integración con Gemini REAL — opcionales, solo local.

No corren en CI: se saltan si no hay GEMINI_API_KEY real. Para ejecutarlos:
    uv run pytest -m integration

IMPORTANTE (Hito 4): el test que confirma el PROCESAMIENTO MULTIMODAL NATIVO del PDF
(que Gemini "ve" el documento sin OCR intermedio) SOLO se puede verificar aquí, con el
modelo real. Mientras el acceso a Gemini esté bloqueado (billing/migración de claves),
este test queda escrito pero SIN CORRER — no se da por confirmado.
"""

import asyncio

import pytest

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_google_model
from multimodal_presenter.pipeline import transform
from multimodal_presenter.schemas import Presentation

_key = get_settings().gemini_api_key
_HAS_REAL_KEY = bool(_key) and _key != "your-gemini-api-key-here"


@pytest.mark.integration
@pytest.mark.skipif(not _HAS_REAL_KEY, reason="requiere GEMINI_API_KEY real (solo local)")
def test_real_gemini_text(input_text: str) -> None:
    model = build_google_model(get_settings())
    result = asyncio.run(transform(model, text=input_text))
    assert isinstance(result.presentation, Presentation)
    assert len(result.presentation.sections) >= 1


@pytest.mark.integration
@pytest.mark.skipif(not _HAS_REAL_KEY, reason="requiere GEMINI_API_KEY real (solo local)")
def test_real_gemini_pdf_native_multimodal(pdf_bytes: bytes) -> None:
    """Confirma que el PDF se procesa como binario multimodal nativo (sin OCR).

    Pendiente de verificación real hasta destrabar el acceso a Gemini. Usa un PDF real
    (reemplazar pdf_bytes por un PDF con tablas/diagramas para una prueba significativa).
    """
    model = build_google_model(get_settings())
    result = asyncio.run(
        transform(model, binary=pdf_bytes, media_type="application/pdf", filename="d.pdf")
    )
    assert isinstance(result.presentation, Presentation)
    assert result.grounding.source_kind == "pdf"
