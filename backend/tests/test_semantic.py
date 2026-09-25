"""Tests de la verificación semántica de gráficos (Fase 3 nivel LLM), con modelo mockeado."""

import asyncio

from pydantic_ai.models.test import TestModel

from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.validation import verify_semantic_coherence
from multimodal_presenter.schemas import Presentation


def _text_pres() -> Presentation:
    return Presentation.model_validate(
        {
            "title": "t",
            "sections": [
                {
                    "id": "t1",
                    "role": "core",
                    "source": {"document_id": "d", "quote": "q"},
                    "content": {"content_type": "text", "text": "hola"},
                }
            ],
        }
    )


def _chart_pres() -> Presentation:
    return Presentation.model_validate(
        {
            "title": "t",
            "sections": [
                {
                    "id": "c1",
                    "role": "satellite",
                    "source": {"document_id": "d", "quote": "q"},
                    "content": {
                        "content_type": "chart",
                        "chart_type": "bar",
                        "data": {
                            "categories": ["A", "B"],
                            "series": [{"name": "v", "values": [1, 2]}],
                        },
                    },
                }
            ],
        }
    )


def test_no_charts_skips_model() -> None:
    # Sin gráficos no se llama al modelo (TestModel devolvería algo inválido si se llamara).
    ext = prepare_input(text="documento")
    report = asyncio.run(
        verify_semantic_coherence(_text_pres(), ext, model=TestModel(custom_output_text="x"))
    )
    assert report.observations == []


def test_reports_observations_from_llm() -> None:
    ext = prepare_input(text="documento")
    model = TestModel(
        custom_output_args={"observations": [{"section_id": "c1", "issue": "no coincide"}]}
    )
    report = asyncio.run(verify_semantic_coherence(_chart_pres(), ext, model=model))
    assert len(report.observations) == 1
    assert report.observations[0].section_id == "c1"
    assert report.ok is False


def test_ok_when_no_observations() -> None:
    ext = prepare_input(text="documento")
    model = TestModel(custom_output_args={"observations": []})
    report = asyncio.run(verify_semantic_coherence(_chart_pres(), ext, model=model))
    assert report.ok is True
