"""Tests de la Fase 3 (grounding determinista)."""

from multimodal_presenter.pipeline.extraction import prepare_document
from multimodal_presenter.pipeline.validation import verify_grounding
from multimodal_presenter.schemas import Presentation


def test_grounding_fills_offsets_and_document_id(input_text: str, mock_presentation: dict) -> None:
    extraction = prepare_document(input_text)
    presentation = Presentation.model_validate(mock_presentation)

    enriched, report = verify_grounding(presentation, extraction)

    assert report.total_sections == 2
    assert report.grounded_sections == 2
    assert report.ungrounded_sections == 0

    for section in enriched.sections:
        src = section.source
        # El offset recorta exactamente el quote en el texto fuente.
        assert src.char_start is not None
        assert input_text[src.char_start : src.char_end] == src.quote
        # El document_id lo fija el código deterministamente (no el LLM).
        assert src.document_id == extraction.document_id


def test_ungrounded_quote_is_flagged_not_fatal(
    input_text: str, mock_presentation_ungrounded: dict
) -> None:
    extraction = prepare_document(input_text)
    presentation = Presentation.model_validate(mock_presentation_ungrounded)

    enriched, report = verify_grounding(presentation, extraction)

    # No es fatal: la presentación se devuelve igual, con el warning registrado.
    assert report.grounded_sections == 1
    assert report.ungrounded_sections == 1
    ungrounded = next(s for s in report.sections if not s.grounded)
    assert ungrounded.char_start is None and ungrounded.char_end is None
