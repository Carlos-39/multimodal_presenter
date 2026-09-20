"""Test del pipeline completo con el LLM mockeado (corre en CI sin API real)."""

import asyncio

from pydantic_ai.models.test import TestModel

from multimodal_presenter.pipeline import transform
from multimodal_presenter.schemas import Presentation


def test_pipeline_produces_valid_contract(input_text: str, mock_presentation: dict) -> None:
    # TestModel devuelve la presentación mock como salida estructurada del agente.
    model = TestModel(custom_output_args=mock_presentation)

    result = asyncio.run(transform(input_text, model=model))

    # Criterio de aceptación: el flujo produce un objeto válido del contrato del Hito 1.
    assert isinstance(result.presentation, Presentation)
    assert result.grounding.total_sections == 2
    assert result.grounding.grounded_sections == 2
    # Fase 3 enriqueció los offsets de fuente.
    first = result.presentation.sections[0]
    assert input_text[first.source.char_start : first.source.char_end] == first.source.quote
    # La interfaz semántica ya se llama y retorna "sin observaciones" (no-op del Hito 2).
    assert result.semantic.ok is True


def test_pipeline_flags_ungrounded_but_still_returns(
    input_text: str, mock_presentation_ungrounded: dict
) -> None:
    model = TestModel(custom_output_args=mock_presentation_ungrounded)

    result = asyncio.run(transform(input_text, model=model))

    assert isinstance(result.presentation, Presentation)
    assert result.grounding.ungrounded_sections == 1  # warning, no error
