"""Fase 3 — Validación posterior.

Nivel barato (determinista): grounding de fuentes, adaptado al tipo de fuente.
- Texto: verifica que `source.quote` exista en el documento (substring) → `verified` con
  offsets, o `not_found` (warning real de fabricación).
- PDF/imagen: NO se puede verificar por substring sin aplanar el binario (contra el
  principio rector). Las secciones quedan `unverified`; para PDF se conserva la página que
  aporta el modelo. La verificación por página/región es TODO(Hito5).

Nivel LLM (coherencia semántica): interfaz real ya cableada, hoy no-op. TODO(Hito2.1).
"""

from pydantic_ai import Agent, BinaryContent
from pydantic_ai.models import Model

from ..schemas import Presentation
from ..schemas.presentation import ChartContent, Section
from ..schemas.transform import (
    GroundingReport,
    SectionGrounding,
    SemanticCoherenceReport,
)
from .models import ExtractionResult


def _ground_text(
    presentation: Presentation, source_text: str, document_id: str
) -> tuple[Presentation, list[SectionGrounding]]:
    reports: list[SectionGrounding] = []
    new_sections = []
    for section in presentation.sections:
        idx = source_text.find(section.source.quote)
        if idx != -1:
            start, end = idx, idx + len(section.source.quote)
            new_source = section.source.model_copy(
                update={"document_id": document_id, "char_start": start, "char_end": end}
            )
            new_sections.append(section.model_copy(update={"source": new_source}))
            reports.append(
                SectionGrounding(
                    section_id=section.id, status="verified", char_start=start, char_end=end
                )
            )
        else:
            new_sections.append(section)
            reports.append(SectionGrounding(section_id=section.id, status="not_found"))
    return presentation.model_copy(update={"sections": new_sections}), reports


def _ground_binary(
    presentation: Presentation, document_id: str
) -> tuple[Presentation, list[SectionGrounding]]:
    # No se verifica por substring (no hay texto sin aplanar). Se conserva la página (PDF).
    reports: list[SectionGrounding] = []
    new_sections = []
    for section in presentation.sections:
        new_source = section.source.model_copy(update={"document_id": document_id})
        new_sections.append(section.model_copy(update={"source": new_source}))
        reports.append(
            SectionGrounding(section_id=section.id, status="unverified", page=section.source.page)
        )
    return presentation.model_copy(update={"sections": new_sections}), reports


def verify_grounding(
    presentation: Presentation, extraction: ExtractionResult
) -> tuple[Presentation, GroundingReport]:
    """Verifica el anclaje a fuente según el tipo de fuente y arma el reporte."""
    if extraction.source_kind == "text":
        assert extraction.text is not None
        enriched, reports = _ground_text(presentation, extraction.text, extraction.document_id)
    else:
        enriched, reports = _ground_binary(presentation, extraction.document_id)

    report = GroundingReport(
        source_kind=extraction.source_kind,
        sections=reports,
        total_sections=len(reports),
        verified_sections=sum(1 for r in reports if r.status == "verified"),
        unverified_sections=sum(1 for r in reports if r.status == "unverified"),
        not_found_sections=sum(1 for r in reports if r.status == "not_found"),
    )
    return enriched, report


_SEMANTIC_PROMPT = """\
Eres un verificador de coherencia. Recibes un documento fuente y una lista de gráficos ya \
generados a partir de él. Tu tarea: comprobar si cada gráfico refleja FIELMENTE lo que dice \
el documento (valores, categorías, relación representada), no solo si tiene forma válida.

Devuelve una observación SOLO por cada gráfico que NO refleje el documento, con su section_id \
y una descripción breve del problema. Si todos son coherentes, devuelve la lista vacía. No \
inventes problemas donde no los hay.\
"""

semantic_agent = Agent(
    output_type=SemanticCoherenceReport,
    system_prompt=_SEMANTIC_PROMPT,
)


def _charts_summary(charts: list[Section]) -> str:
    lines = []
    for section in charts:
        content = section.content
        assert isinstance(content, ChartContent)
        series = [(s.name, s.values) for s in content.data.series]
        lines.append(
            f"[section_id={section.id}] tipo={content.chart_type} "
            f"categorías={content.data.categories} series={series}"
        )
    return "\n".join(lines)


async def verify_semantic_coherence(
    presentation: Presentation, extraction: ExtractionResult, model: Model
) -> SemanticCoherenceReport:
    """Fase 3 (nivel LLM) — coherencia semántica de los gráficos contra la fuente.

    Segunda pasada de LLM (Punto 3). Enfocada en gráficos para el Hito 5a. Es una llamada
    adicional al modelo; queda trazada en Logfire (instrumentación global de PydanticAI).
    Si no hay gráficos, no llama al modelo. TODO(Hito5x): extender a otros tipos de contenido.
    """
    charts = [s for s in presentation.sections if isinstance(s.content, ChartContent)]
    if not charts:
        return SemanticCoherenceReport(observations=[])

    prompt = (
        "Gráficos generados:\n"
        + _charts_summary(charts)
        + "\n\n¿Cada gráfico refleja fielmente el documento fuente?"
    )
    if extraction.source_kind == "text":
        assert extraction.text is not None
        user_input: str | list = f"{prompt}\n\n--- DOCUMENTO ---\n{extraction.text}"
    else:
        assert extraction.binary is not None and extraction.media_type is not None
        user_input = [
            prompt,
            BinaryContent(data=extraction.binary, media_type=extraction.media_type),
        ]

    result = await semantic_agent.run(user_input, model=model)
    return result.output
