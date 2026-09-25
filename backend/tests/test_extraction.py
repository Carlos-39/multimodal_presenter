"""Tests de la Fase 1 (extracción/preparación determinista)."""

import pytest

from multimodal_presenter.pipeline.extraction import prepare_input


def test_text_source(input_text: str) -> None:
    result = prepare_input(text=input_text)
    assert result.source_kind == "text"
    assert result.document_id.startswith("doc-")
    assert result.paragraph_count == 2
    for seg in result.segments:
        assert input_text[seg.char_start : seg.char_end] == seg.text
    assert result.has_numbers is True


def test_pdf_source_keeps_binary(pdf_bytes: bytes) -> None:
    result = prepare_input(binary=pdf_bytes, media_type="application/pdf", filename="d.pdf")
    assert result.source_kind == "pdf"
    assert result.binary == pdf_bytes  # NO se aplana a texto
    assert result.text is None
    assert result.media_type == "application/pdf"


def test_image_source(png_bytes: bytes) -> None:
    result = prepare_input(binary=png_bytes, media_type="image/png")
    assert result.source_kind == "image"
    assert result.binary == png_bytes


def test_text_plus_binary_treats_text_as_instruction(pdf_bytes: bytes) -> None:
    result = prepare_input(
        text="explícame esto sin asumir conocimiento",
        binary=pdf_bytes,
        media_type="application/pdf",
    )
    assert result.source_kind == "pdf"
    assert result.instruction == "explícame esto sin asumir conocimiento"
    assert result.text is None  # el documento es el binario, no el texto


def test_requires_some_input() -> None:
    with pytest.raises(ValueError):
        prepare_input()
