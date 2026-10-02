"""Pipeline de transformación — las fases como pasos separados.

Fase 0 (percepción de audio, solo si la fuente es audio) → Fase 1 (determinista) →
Fase 2 (LLM) → Fase 3 (determinista + interfaz semántica).
Acepta texto, binario (PDF/imagen), audio, o texto+archivo. Cada fase queda trazada en Logfire.

La Fase 0 es nueva y AISLADA: para texto, PDF e imagen no se ejecuta y el flujo de las Fases
1-3 es exactamente el de siempre. Ver `perception.py` para el por qué.
"""

import logfire
from pydantic_ai.models import Model

from ..schemas.transform import SemanticCoherenceReport
from .extraction import prepare_input
from .isomorphism import enforce_isomorphism
from .models import PipelineResult
from .perception import run_perception
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
    semantic_model: Model | None = None,
    semantic_enabled: bool = True,
    perception_model: Model | None = None,
) -> PipelineResult:
    """Ejecuta el pipeline completo: fuente → presentación validada + reportes.

    `semantic_model` (verificación semántica, Fase 3 nivel LLM) usa `model` por defecto; se
    separa para poder inyectar un mock distinto en tests. `semantic_enabled=False` salta esa
    llamada extra (control de costo en desarrollo).

    `perception_model` solo se usa si la fuente es audio (Fase 0); para el resto se ignora.
    """
    semantic_model = semantic_model or model
    with logfire.span("pipeline.transform"):
        evidence = await run_perception(binary, media_type, perception_model)

        with logfire.span("fase1.extraccion"):
            extraction = prepare_input(
                text=text,
                binary=binary,
                media_type=media_type,
                filename=filename,
                audio_evidence=evidence,
            )

        with logfire.span("fase2.estructuracion"):
            presentation = await structure_document(extraction, model)

        with logfire.span("fase3.validacion"):
            # Grounding (barato) + isomorfismo determinista (corrige/degrada gráficos).
            presentation, grounding = verify_grounding(presentation, extraction)
            presentation, chart_notes = enforce_isomorphism(presentation)
            if chart_notes:
                logfire.info(
                    "isomorfismo: {n} gráfico(s) ajustado(s)",
                    n=len(chart_notes),
                    notes=[note.model_dump() for note in chart_notes],
                )

            # Coherencia semántica (nivel LLM, enfocada en gráficos) — llamada adicional.
            if semantic_enabled:
                with logfire.span("fase3.semantica"):
                    semantic = await verify_semantic_coherence(
                        presentation, extraction, semantic_model
                    )
            else:
                semantic = SemanticCoherenceReport()

        return PipelineResult(
            presentation=presentation,
            grounding=grounding,
            semantic=semantic,
            chart_notes=chart_notes,
        )
