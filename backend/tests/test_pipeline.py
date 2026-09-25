"""Tests del pipeline con el LLM mockeado (corren en CI sin API real)."""

import asyncio

from pydantic_ai import BinaryContent
from pydantic_ai.models.test import TestModel

from multimodal_presenter.pipeline import transform
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.structuring import build_model_input
from multimodal_presenter.schemas import Presentation


def test_text_pipeline_produces_valid_contract(input_text: str, mock_presentation: dict) -> None:
    model = TestModel(custom_output_args=mock_presentation)
    result = asyncio.run(transform(model, text=input_text))

    assert isinstance(result.presentation, Presentation)
    assert result.grounding.source_kind == "text"
    assert result.grounding.verified_sections == 2
    first = result.presentation.sections[0]
    assert input_text[first.source.char_start : first.source.char_end] == first.source.quote
    assert result.semantic.ok is True


def test_pdf_pipeline_produces_valid_contract(pdf_bytes: bytes, mock_presentation: dict) -> None:
    model = TestModel(custom_output_args=mock_presentation)
    result = asyncio.run(
        transform(model, binary=pdf_bytes, media_type="application/pdf", filename="d.pdf")
    )

    assert isinstance(result.presentation, Presentation)
    assert result.grounding.source_kind == "pdf"
    # Fuente binaria → grounding pendiente de verificación (no fallo).
    assert result.grounding.unverified_sections == len(result.presentation.sections)


def test_binary_reaches_model_well_formed(pdf_bytes: bytes) -> None:
    """El binario debe llegar como BinaryContent con los bytes y media_type correctos."""
    extraction = prepare_input(
        text="explícame esto", binary=pdf_bytes, media_type="application/pdf"
    )
    model_input = build_model_input(extraction)

    assert isinstance(model_input, list)
    binaries = [p for p in model_input if isinstance(p, BinaryContent)]
    assert len(binaries) == 1
    assert binaries[0].data == pdf_bytes
    assert binaries[0].media_type == "application/pdf"
    # La instrucción del usuario viaja junto al binario.
    assert any(isinstance(p, str) and "explícame esto" in p for p in model_input)
