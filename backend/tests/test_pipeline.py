"""Tests del pipeline con el LLM mockeado (corren en CI sin API real)."""

import asyncio

from pydantic_ai import BinaryContent
from pydantic_ai.models.test import TestModel

from multimodal_presenter.pipeline import transform
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.structuring import build_model_input
from multimodal_presenter.schemas import Presentation


def test_text_pipeline_produces_valid_contract(
    input_text: str, mock_presentation: dict, structuring_model
) -> None:
    model = structuring_model(mock_presentation)
    result = asyncio.run(transform(model, text=input_text))

    assert isinstance(result.presentation, Presentation)
    assert result.grounding.source_kind == "text"
    assert result.grounding.verified_sections == 2
    first = result.presentation.sections[0]
    assert input_text[first.source.char_start : first.source.char_end] == first.source.quote
    assert result.semantic.ok is True


def test_pdf_pipeline_produces_valid_contract(
    pdf_bytes: bytes, mock_presentation: dict, structuring_model
) -> None:
    model = structuring_model(mock_presentation)
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


_PRES_WITH_CHART = {
    "title": "Con gráfico",
    "sections": [
        {
            "id": "t1",
            "role": "core",
            "source": {"document_id": "x", "quote": "resumen"},
            "content": {"content_type": "text", "text": "un resumen"},
        },
        {
            "id": "c1",
            "role": "satellite",
            "source": {"document_id": "x", "quote": "datos"},
            "content": {
                "content_type": "chart",
                "chart_type": "bar",
                "data": {"categories": ["A", "B"], "series": [{"name": "v", "values": [1, 2]}]},
            },
        },
    ],
}


def test_pipeline_with_chart_runs_isomorphism_and_semantic(
    input_text: str, structuring_model
) -> None:
    model = structuring_model(_PRES_WITH_CHART)
    semantic_model = TestModel(custom_output_args={"observations": []})
    result = asyncio.run(transform(model, text=input_text, semantic_model=semantic_model))

    assert isinstance(result.presentation, Presentation)
    # bar categórico es isomorfo → se conserva, sin notas.
    assert result.chart_notes == []
    assert result.semantic.ok is True
