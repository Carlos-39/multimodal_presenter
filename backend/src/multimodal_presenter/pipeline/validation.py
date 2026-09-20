"""Fase 3 — Validación posterior.

Nivel barato (determinista, código, sin LLM): grounding de fuentes. PydanticAI ya garantiza
que la salida cumple el contrato (source presente, roles válidos, tipos alineados), así que
re-verificar eso sería redundante. Lo que aporta valor barato y determinista es comprobar
que cada `source.quote` EXISTE de verdad en el documento fuente, y —de paso— calcular sus
offsets en código (el LLM no calcula offsets: eso es objetivo, va en código).

Nivel LLM (coherencia semántica): interfaz real ya cableada, hoy no-op. Ver
`verify_semantic_coherence`.
"""

from ..schemas import Presentation
from ..schemas.transform import (
    GroundingReport,
    SectionGrounding,
    SemanticCoherenceReport,
)
from .models import ExtractionResult


def verify_grounding(
    presentation: Presentation, extraction: ExtractionResult
) -> tuple[Presentation, GroundingReport]:
    """Verifica el anclaje a fuente y enriquece los offsets deterministamente.

    - Si `source.quote` existe en el texto fuente → rellena char_start/char_end y fija el
      document_id correcto (qué documento es, es objetivo → lo decide el código).
    - Si no existe → se marca como no anclada (warning no-fatal en esta versión, ver TODO
      de GroundingReport). La presentación se devuelve igual para poder iterar el flujo.
    """
    source_text = extraction.text
    section_reports: list[SectionGrounding] = []
    new_sections = []

    for section in presentation.sections:
        idx = source_text.find(section.source.quote)
        grounded = idx != -1

        if grounded:
            start: int | None = idx
            end: int | None = idx + len(section.source.quote)
            new_source = section.source.model_copy(
                update={
                    "document_id": extraction.document_id,
                    "char_start": start,
                    "char_end": end,
                }
            )
            new_sections.append(section.model_copy(update={"source": new_source}))
        else:
            start = end = None
            new_sections.append(section)

        section_reports.append(
            SectionGrounding(
                section_id=section.id, grounded=grounded, char_start=start, char_end=end
            )
        )

    grounded_count = sum(1 for r in section_reports if r.grounded)
    report = GroundingReport(
        sections=section_reports,
        total_sections=len(section_reports),
        grounded_sections=grounded_count,
        ungrounded_sections=len(section_reports) - grounded_count,
    )
    enriched = presentation.model_copy(update={"sections": new_sections})
    return enriched, report


def verify_semantic_coherence(
    presentation: Presentation, extraction: ExtractionResult
) -> SemanticCoherenceReport:
    """Fase 3 (nivel LLM) — coherencia semántica contenido↔fuente.

    Interfaz real: el pipeline ya la llama y consume su resultado. Hoy es un no-op que
    retorna "sin observaciones".

    TODO(Hito2.1): implementar el cuerpo — una segunda pasada de LLM que compare que el
    contenido generado refleja realmente lo que dice el documento (los LLM tienden a
    producir salidas que "parecen" correctas). La firma y el punto de llamada ya están; solo
    falta llenar el cuerpo.
    """
    return SemanticCoherenceReport(observations=[])
