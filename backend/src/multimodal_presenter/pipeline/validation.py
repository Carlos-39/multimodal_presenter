"""Fase 3 — Validación posterior.

Nivel barato (determinista): grounding de fuentes, adaptado al tipo de fuente.
- Texto: verifica que `source.quote` exista en el documento (substring) → `verified` con
  offsets, o `not_found` (warning real de fabricación).
- PDF/imagen: NO se puede verificar por substring sin aplanar el binario (contra el
  principio rector). Las secciones quedan `unverified`; para PDF se conserva la página que
  aporta el modelo. La verificación por página/región es TODO(Hito5).

Nivel LLM (coherencia semántica): interfaz real ya cableada, hoy no-op. TODO(Hito2.1).
"""

from ..schemas import Presentation
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


def verify_semantic_coherence(
    presentation: Presentation, extraction: ExtractionResult
) -> SemanticCoherenceReport:
    """Fase 3 (nivel LLM) — coherencia semántica contenido↔fuente.

    Interfaz real: el pipeline ya la llama y consume su resultado. Hoy no-op.
    TODO(Hito2.1): implementar el cuerpo (segunda pasada de LLM que compare el contenido
    generado con lo que dice el documento).
    """
    return SemanticCoherenceReport(observations=[])
