"""Tests de la Fase 3 (grounding determinista) con los tres estados."""

from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.validation import verify_grounding
from multimodal_presenter.schemas import Presentation


def test_text_grounding_verified_fills_offsets(input_text: str, mock_presentation: dict) -> None:
    extraction = prepare_input(text=input_text)
    presentation = Presentation.model_validate(mock_presentation)

    enriched, report = verify_grounding(presentation, extraction)

    assert report.source_kind == "text"
    assert report.verified_sections == 2
    assert report.not_found_sections == 0
    for section in enriched.sections:
        src = section.source
        assert src.char_start is not None
        assert input_text[src.char_start : src.char_end] == src.quote
        assert src.document_id == extraction.document_id
    assert all(s.status == "verified" for s in report.sections)


def test_text_grounding_not_found_is_flagged(
    input_text: str, mock_presentation_ungrounded: dict
) -> None:
    extraction = prepare_input(text=input_text)
    presentation = Presentation.model_validate(mock_presentation_ungrounded)

    _enriched, report = verify_grounding(presentation, extraction)

    assert report.verified_sections == 1
    assert report.not_found_sections == 1  # warning real
    assert any(s.status == "not_found" for s in report.sections)


def test_binary_grounding_is_unverified(pdf_bytes: bytes, mock_presentation: dict) -> None:
    extraction = prepare_input(binary=pdf_bytes, media_type="application/pdf")
    presentation = Presentation.model_validate(mock_presentation)

    _enriched, report = verify_grounding(presentation, extraction)

    # Sin aplanar el binario no se puede verificar: 'unverified', NO 'not_found'.
    assert report.source_kind == "pdf"
    assert report.unverified_sections == len(presentation.sections)
    assert report.not_found_sections == 0
    assert all(s.status == "unverified" for s in report.sections)
