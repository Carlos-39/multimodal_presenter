"""Pipeline de transformación en STREAMING (Hito 5d).

Emite secciones COMPLETAS una por una (grano por Section) a medida que el LLM las termina,
vía `agent.run_stream` + `stream_output()` (Ruta A: PydanticAI valida objetos parciales; el
backend solo reenvía una sección cuando ya está completa — nunca JSON a medio construir).

Cada sección pasa por la Fase 3 POR SECCIÓN (grounding + isomorfismo) antes de emitirse, así
es indistinguible en forma de una del contrato no-streaming. El `GroundingReport` agregado y
la verificación semántica (2ª llamada) van en el evento final `done`.
"""

from collections.abc import AsyncIterator

import logfire
from pydantic_ai.models import Model

from ..schemas import Presentation
from ..schemas.presentation import Section
from ..schemas.transform import (
    ChartNote,
    SectionGrounding,
    SemanticCoherenceReport,
    StreamDone,
    StreamError,
    StreamSection,
    StreamStart,
)
from .extraction import prepare_input
from .isomorphism import isomorphize_section
from .perception import run_perception
from .structuring import build_model_input, structuring_agent
from .validation import build_grounding_report, ground_section, verify_semantic_coherence

StreamEvent = StreamStart | StreamSection | StreamDone | StreamError


def _section_is_complete(section: Section) -> bool:
    """Una sección está completa si valida en modo estricto (todos los campos presentes)."""
    try:
        Section.model_validate(section.model_dump())
        return True
    except Exception:
        return False


class SectionEmitter:
    """Decide qué secciones ya están COMPLETAS a partir de los `Presentation` parciales.

    Regla reproducible: una sección está terminada cuando ya empezó la siguiente (el modelo
    pasó de largo); la última se emite cuando el stream termina (`final=True`).
    """

    def __init__(self) -> None:
        self.emitted = 0

    def take(self, partial: Presentation, *, final: bool) -> list[Section]:
        sections = partial.sections or []
        limit = len(sections) if final else len(sections) - 1
        out: list[Section] = []
        while self.emitted < limit and _section_is_complete(sections[self.emitted]):
            out.append(sections[self.emitted])
            self.emitted += 1
        return out


async def transform_stream(
    model: Model,
    *,
    text: str | None = None,
    binary: bytes | None = None,
    media_type: str | None = None,
    filename: str | None = None,
    semantic_model: Model | None = None,
    semantic_enabled: bool = True,
    perception_model: Model | None = None,
) -> AsyncIterator[StreamEvent]:
    """Ejecuta el pipeline en streaming, emitiendo eventos SSE tipados.

    `perception_model` solo se usa si la fuente es audio (Fase 0, antes de la Fase 1).
    """
    semantic_model = semantic_model or model
    sections: list[Section] = []
    entries: list[SectionGrounding] = []
    chart_notes: list[ChartNote] = []
    title = ""
    title_sent = False

    def finalize(section: Section) -> StreamSection:
        # Fase 3 por sección: grounding (offsets/estado) + isomorfismo (corrige/degrada).
        grounded, entry = ground_section(section, extraction)
        iso, note = isomorphize_section(grounded)
        sections.append(iso)
        entries.append(entry)
        if note is not None:
            chart_notes.append(note)
        return StreamSection(section=iso, grounding=entry, chart_note=note)

    with logfire.span("pipeline.transform_stream"):
        # Fase 0 (solo audio): ocurre ANTES de abrir el stream, así que el usuario ve el
        # indicador de carga hasta que la percepción termina y después las secciones llegan
        # una por una como siempre. No se emite nada a medias.
        evidence = await run_perception(binary, media_type, perception_model)

        extraction = prepare_input(
            text=text,
            binary=binary,
            media_type=media_type,
            filename=filename,
            audio_evidence=evidence,
        )
        emitter = SectionEmitter()

        with logfire.span("fase2.estructuracion.stream"):
            async with structuring_agent.run_stream(
                build_model_input(extraction), model=model
            ) as result:
                async for partial in result.stream_output():
                    if not title_sent and getattr(partial, "title", None):
                        title = partial.title
                        title_sent = True
                        yield StreamStart(title=title)
                    for section in emitter.take(partial, final=False):
                        yield finalize(section)

                final_output = await result.get_output()
                title = final_output.title or title
                if not title_sent:
                    title_sent = True
                    yield StreamStart(title=title or "Presentación")
                for section in emitter.take(final_output, final=True):
                    yield finalize(section)

        if not sections:
            yield StreamError(message="No se generaron secciones.")
            return

        with logfire.span("fase3.validacion.stream"):
            presentation = Presentation(title=title or "Presentación", sections=sections)
            grounding = build_grounding_report(extraction.source_kind, entries)
            if semantic_enabled:
                semantic = await verify_semantic_coherence(presentation, extraction, semantic_model)
            else:
                semantic = SemanticCoherenceReport()

        yield StreamDone(grounding=grounding, semantic=semantic, chart_notes=chart_notes)
