"""Pipeline de transformación — las tres fases como pasos separados.

Fase 1 (determinista) → Fase 2 (LLM) → Fase 3 (determinista + interfaz semántica).
Acepta texto, binario (PDF/imagen), o ambos (texto como instrucción + binario como documento).
Cada fase queda trazada en Logfire.
"""

import logfire
from pydantic_ai.models import Model

from .extraction import prepare_input
from .models import PipelineResult
from .structuring import structure_document
from .validation import verify_grounding, verify_semantic_coherence

__all__ = ["transform", "PipelineResult"]


async def transform(
    model: Model,
    *,
    text: str | None = None,
    binary: bytes | None = None,
    media_type: str | None = None,
    filename: str | None = None,
) -> PipelineResult:
    """Ejecuta el pipeline completo: fuente → presentación validada + reportes."""
    with logfire.span("pipeline.transform"):
        with logfire.span("fase1.extraccion"):
            extraction = prepare_input(
                text=text, binary=binary, media_type=media_type, filename=filename
            )

        with logfire.span("fase2.estructuracion"):
            presentation = await structure_document(extraction, model)

        with logfire.span("fase3.validacion"):
            presentation, grounding = verify_grounding(presentation, extraction)
            semantic = verify_semantic_coherence(presentation, extraction)
            logfire.info(
                "grounding ({kind}): {verified} verificadas, {unverified} sin verificar, "
                "{not_found} no encontradas de {total}",
                kind=grounding.source_kind,
                verified=grounding.verified_sections,
                unverified=grounding.unverified_sections,
                not_found=grounding.not_found_sections,
                total=grounding.total_sections,
            )

        return PipelineResult(presentation=presentation, grounding=grounding, semantic=semantic)
