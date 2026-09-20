"""Pipeline de transformación (Hito 2) — las tres fases como pasos separados.

Fase 1 (determinista) → Fase 2 (LLM) → Fase 3 (determinista + interfaz semántica).
Cada fase queda trazada en Logfire para depuración y para la telemetría del Hito 8.
"""

import logfire
from pydantic_ai.models import Model

from .extraction import prepare_document
from .models import PipelineResult
from .structuring import structure_document
from .validation import verify_grounding, verify_semantic_coherence

__all__ = ["transform", "PipelineResult"]


async def transform(text: str, model: Model) -> PipelineResult:
    """Ejecuta el pipeline completo: texto → presentación validada + reportes."""
    with logfire.span("pipeline.transform"):
        with logfire.span("fase1.extraccion"):
            extraction = prepare_document(text)

        with logfire.span("fase2.estructuracion"):
            presentation = await structure_document(extraction, model)

        with logfire.span("fase3.validacion"):
            presentation, grounding = verify_grounding(presentation, extraction)
            semantic = verify_semantic_coherence(presentation, extraction)
            logfire.info(
                "grounding: {grounded}/{total} secciones ancladas",
                grounded=grounding.grounded_sections,
                total=grounding.total_sections,
            )

        return PipelineResult(presentation=presentation, grounding=grounding, semantic=semantic)
