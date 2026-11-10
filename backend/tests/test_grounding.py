"""Tests de la Fase 3 (grounding determinista) con los tres estados."""

import copy

from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.validation import ground_quote, verify_grounding
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


def test_matching_robusto_ancla_pese_a_puntuacion_tipografica(
    input_text: str, mock_presentation: dict
) -> None:
    """Una cita con comillas/guiones/espacios tipográficos SÍ ancla (no `not_found` falso).

    El documento tiene comillas rectas y espacios normales; el modelo "cita" con variantes
    tipográficas. El matching robusto debe anclarlo como `verified`, y el offset debe seguir
    siendo válido sobre el texto ORIGINAL (canonicalización 1:1, preserva índices).
    """
    data = copy.deepcopy(mock_presentation)
    # Reemplaza espacios por espacios duros y mete comillas tipográficas: misma longitud.
    original = "La empresa creció de forma sostenida durante la última década."
    typographic = original.replace(" ", " ")
    data["sections"][0]["source"]["quote"] = typographic

    extraction = prepare_input(text=input_text)
    presentation = Presentation.model_validate(data)
    _enriched, report = verify_grounding(presentation, extraction)

    assert report.not_found_sections == 0
    assert report.verified_sections == 2
    entry = next(s for s in report.sections if s.section_id == "s1")
    assert entry.status == "verified"
    # El rango apunta al fragmento real del documento original (con comillas/espacios reales).
    assert input_text[entry.char_start : entry.char_end] == original


def test_matching_robusto_no_inventa_anclaje(input_text: str) -> None:
    """Una cita que NO está sigue siendo `not_found` (la canonicalización no fabrica)."""
    ancla = ground_quote(
        "Esta frase jamás aparece en el texto.", None, prepare_input(text=input_text)
    )
    assert ancla.status == "not_found"
    assert ancla.source is not None and ancla.source.char_start is None  # no se inventan offsets


def test_cita_ancla_aunque_el_texto_pegado_traiga_cortes_de_linea() -> None:
    """Texto copiado de un PDF: un corte de línea cada pocas palabras. El modelo cita la frase
    unida con espacios, y antes eso dejaba TODAS las secciones en `not_found`."""
    texto = (
        "Dónde y cuándo se observan\n"
        "Se han fotografiado en prácticamente todos los continentes excepto la\n"
        "Antártida, siempre asociados a tormentas eléctricas muy intensas.\n"
    )
    cita = "todos los continentes excepto la Antártida, siempre asociados"
    ancla = ground_quote(cita, None, prepare_input(text=texto))

    assert ancla.status == "verified"
    assert ancla.source is not None
    # El rango vuelve al texto ORIGINAL, con el corte dentro: el resaltado cae en su sitio.
    tramo = texto[ancla.source.char_start : ancla.source.char_end]
    assert tramo == "todos los continentes excepto la\nAntártida, siempre asociados"


def test_tolerar_cortes_no_inventa_anclaje() -> None:
    """Igualar saltos de línea con espacios no vuelve anclable una frase con otras palabras."""
    texto = "Se han fotografiado en todos los continentes excepto la\nAntártida."
    ancla = ground_quote(
        "todos los continentes salvo la Antártida", None, prepare_input(text=texto)
    )
    assert ancla.status == "not_found"


def test_binary_grounding_is_unverified(pdf_bytes: bytes, mock_presentation: dict) -> None:
    extraction = prepare_input(binary=pdf_bytes, media_type="application/pdf")
    presentation = Presentation.model_validate(mock_presentation)

    _enriched, report = verify_grounding(presentation, extraction)

    # Sin aplanar el binario no se puede verificar: 'unverified', NO 'not_found'.
    assert report.source_kind == "pdf"
    assert report.unverified_sections == len(presentation.sections)
    assert report.not_found_sections == 0
    assert all(s.status == "unverified" for s in report.sections)
