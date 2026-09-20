"""Tests de la Fase 1 (extracción determinista)."""

from multimodal_presenter.pipeline.extraction import prepare_document


def test_document_id_is_stable(input_text: str) -> None:
    assert prepare_document(input_text).document_id == prepare_document(input_text).document_id
    assert prepare_document(input_text).document_id.startswith("doc-")


def test_segments_offsets_map_back_to_original_text(input_text: str) -> None:
    result = prepare_document(input_text)
    assert result.paragraph_count == 2
    # Cada segmento debe recortar EXACTAMENTE su texto desde los offsets del original.
    for seg in result.segments:
        assert input_text[seg.char_start : seg.char_end] == seg.text


def test_has_numbers_flag(input_text: str) -> None:
    assert prepare_document(input_text).has_numbers is True
    assert prepare_document("solo texto sin cifras").has_numbers is False
