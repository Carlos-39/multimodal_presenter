"""Fase 3 — Validación posterior.

Nivel barato (determinista): grounding de fuentes, adaptado al tipo de fuente.
- Texto: verifica que `source.quote` exista en el documento (substring) → `verified` con
  offsets, o `not_found` (warning real de fabricación).
- PDF/imagen: NO se puede verificar por substring sin aplanar el binario (contra el
  principio rector). Las secciones quedan `unverified`; para PDF se conserva la página que
  aporta el modelo. La verificación por página/región es TODO(Hito5).

Nivel LLM (coherencia semántica): interfaz real ya cableada, hoy no-op. TODO(Hito2.1).
"""

from pydantic_ai import Agent, BinaryContent, ToolOutput
from pydantic_ai.models import Model

from ..schemas import Presentation
from ..schemas.presentation import ChartContent, Section, SourceReference
from ..schemas.transform import (
    GroundingReport,
    GroundingStatus,
    SectionGrounding,
    SemanticCoherenceReport,
)
from .models import ExtractionResult

# Matching robusto (Hito 8): un modelo fiel a veces cita con comillas tipográficas, espacios duros
# o guiones distintos a los del documento, y un `find` exacto lo marcaría `not_found` FALSO. Se
# canonicaliza la puntuación antes de comparar. El mapa es estrictamente 1 carácter → 1 carácter
# (misma longitud), así que el índice hallado sobre el texto canónico sigue siendo válido sobre el
# texto ORIGINAL → el resaltado del 5c se mantiene exacto. NO se toca la semántica (no minúsculas,
# no colapso de espacios): solo se unifican variantes tipográficas de un mismo signo.
_CANON_MAP = str.maketrans(
    {
        "“": '"',  # “
        "”": '"',  # ”
        "‘": "'",  # ‘
        "’": "'",  # ’
        " ": " ",  # espacio duro
        " ": " ",  # espacio fino duro
        " ": " ",  # espacio fino
        " ": " ",  # espacio de figura
        "​": " ",  # espacio de ancho cero
        "–": "-",  # – (en dash)
        "—": "-",  # — (em dash)
        "−": "-",  # − (signo menos)
    }
)


def _find_quote(text: str, quote: str) -> int:
    """Índice de `quote` en `text`: exacto primero; si falla, sobre la forma canónica (1:1)."""
    idx = text.find(quote)
    if idx != -1:
        return idx
    return text.translate(_CANON_MAP).find(quote.translate(_CANON_MAP))


def ground_section(
    section: Section, extraction: ExtractionResult
) -> tuple[Section, SectionGrounding]:
    """Ancla UNA sección a su fuente. Devuelve (sección enriquecida, entrada de grounding).

    Determinista y por sección → reutilizable en el pipeline completo y en streaming.
    """
    if extraction.source_kind == "text":
        assert extraction.text is not None
        idx = _find_quote(extraction.text, section.source.quote)
        if idx != -1:
            start, end = idx, idx + len(section.source.quote)
            new_source = section.source.model_copy(
                update={
                    "document_id": extraction.document_id,
                    "char_start": start,
                    "char_end": end,
                }
            )
            entry = SectionGrounding(
                section_id=section.id, status="verified", char_start=start, char_end=end
            )
            return section.model_copy(update={"source": new_source}), entry
        return section, SectionGrounding(section_id=section.id, status="not_found")

    # Binario: no se verifica por substring (no hay texto sin aplanar). Se conserva la página.
    new_source = section.source.model_copy(update={"document_id": extraction.document_id})
    entry = SectionGrounding(section_id=section.id, status="unverified", page=section.source.page)
    return section.model_copy(update={"source": new_source}), entry


def ground_quote(
    quote: str | None, page: int | None, extraction: ExtractionResult
) -> tuple[SourceReference | None, GroundingStatus]:
    """Ancla una CITA suelta (respuesta de chat, Hito 6) con la misma regla determinista.

    - Sin cita → `(None, "not_found")`: el modelo no pudo anclar; no se inventa una fuente.
    - Texto: si la cita existe → `verified` con offsets; si no → `not_found` (fabricación).
    - Binario (PDF/imagen): `unverified`, conservando la página (Caso B del 5c).
    """
    if not quote:
        return None, "not_found"
    if extraction.source_kind == "text":
        assert extraction.text is not None
        idx = _find_quote(extraction.text, quote)
        if idx != -1:
            source = SourceReference(
                document_id=extraction.document_id,
                quote=quote,
                char_start=idx,
                char_end=idx + len(quote),
            )
            return source, "verified"
        return SourceReference(document_id=extraction.document_id, quote=quote), "not_found"

    source = SourceReference(document_id=extraction.document_id, quote=quote, page=page)
    return source, "unverified"


def build_grounding_report(source_kind: str, entries: list[SectionGrounding]) -> GroundingReport:
    """Agrega las entradas por sección en el reporte holístico."""
    return GroundingReport(
        source_kind=source_kind,  # type: ignore[arg-type]
        sections=entries,
        total_sections=len(entries),
        verified_sections=sum(1 for r in entries if r.status == "verified"),
        unverified_sections=sum(1 for r in entries if r.status == "unverified"),
        not_found_sections=sum(1 for r in entries if r.status == "not_found"),
    )


def verify_grounding(
    presentation: Presentation, extraction: ExtractionResult
) -> tuple[Presentation, GroundingReport]:
    """Verifica el anclaje a fuente de toda la presentación y arma el reporte."""
    new_sections: list[Section] = []
    entries: list[SectionGrounding] = []
    for section in presentation.sections:
        new_section, entry = ground_section(section, extraction)
        new_sections.append(new_section)
        entries.append(entry)
    report = build_grounding_report(extraction.source_kind, entries)
    return presentation.model_copy(update={"sections": new_sections}), report


_SEMANTIC_PROMPT = """\
Eres un verificador de coherencia. Recibes un documento fuente y una lista de gráficos ya \
generados a partir de él. Tu tarea: comprobar si cada gráfico refleja FIELMENTE lo que dice \
el documento (valores, categorías, relación representada), no solo si tiene forma válida.

Devuelve una observación SOLO por cada gráfico que NO refleje el documento, con su section_id \
y una descripción breve del problema. Si todos son coherentes, devuelve la lista vacía. No \
inventes problemas donde no los hay.\
"""

semantic_agent = Agent(
    output_type=ToolOutput(SemanticCoherenceReport),
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
