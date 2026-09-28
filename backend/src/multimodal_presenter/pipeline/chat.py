"""Chat anclado a fuentes (Hito 6).

Arquitectura (decidida en Fase 2, no se reabre): cada turno RELEE el documento ORIGINAL
completo — nunca busca sobre la `Presentation` (que es una selección núcleo/satélite y perdería
contenido). Para no reprocesar el documento en cada turno se usa **prompt caching** de Anthropic
vía `CachePoint`: el documento va antes del marcador y queda cacheado; cada pregunta solo procesa
lo nuevo (historial + pregunta).

Anclaje: el LLM aporta la cita (`source_quote`); el código la valida con la MISMA regla
determinista de la Fase 3 (`ground_quote`). Si no se puede anclar, se dice con honestidad — no
se fabrica una fuente (mismo espíritu que `not_found` en 5c).
"""

from collections.abc import AsyncIterator

import logfire
from pydantic_ai import Agent, BinaryContent, CachePoint, PromptedOutput
from pydantic_ai.models import Model

from ..schemas.chat import (
    ChatAnswer,
    ChatResponse,
    ChatStreamDone,
    ChatStreamText,
    ChatTurn,
    SuggestionsResponse,
)
from ..schemas.presentation import Section
from .models import ExtractionResult
from .validation import ground_quote

ChatEvent = ChatStreamText | ChatStreamDone

_CHAT_PROMPT = """\
Eres un asistente que responde preguntas SOBRE un documento. Reglas:
- Responde ÚNICAMENTE con información del documento; no uses conocimiento externo ni inventes.
- Cada respuesta debe respaldarse en una CITA textual EXACTA del documento: ponla en \
`source_quote` (cópiala tal cual, sin parafrasear). Si es un PDF, indica también `source_page`.
- Si la pregunta NO se puede responder desde el documento, deja `source_quote` en null y dilo \
con honestidad en el texto (no finjas seguridad ni inventes una fuente).
- Elige el `content_type` que mejor represente la respuesta: normalmente `text`; usa `table`, \
`chart` o `timeline` SOLO si la respuesta es información que se entiende mejor así.
- Responde en el idioma del documento y la pregunta.\
"""

_SUGGESTIONS_PROMPT = """\
Genera entre 2 y 3 preguntas breves y ESPECÍFICAS que un lector se haría para profundizar en la \
sección indicada, todas respondibles desde el documento. Nada de preguntas genéricas ("¿de qué \
trata?"). Devuelve solo las preguntas.\
"""

chat_agent = Agent(output_type=PromptedOutput(ChatAnswer), system_prompt=_CHAT_PROMPT)
suggestions_agent = Agent(
    output_type=PromptedOutput(SuggestionsResponse), system_prompt=_SUGGESTIONS_PROMPT
)


def _doc_parts(extraction: ExtractionResult) -> list[str | BinaryContent]:
    """El documento como partes de prompt: texto plano o binario nativo (PDF/imagen)."""
    if extraction.source_kind == "text":
        assert extraction.text is not None
        return [f"--- DOCUMENTO ---\n{extraction.text}\n--- FIN DEL DOCUMENTO ---"]
    assert extraction.binary is not None and extraction.media_type is not None
    return [
        "--- DOCUMENTO (adjunto) ---",
        BinaryContent(data=extraction.binary, media_type=extraction.media_type),
    ]


def _render_history(history: list[ChatTurn]) -> str:
    if not history:
        return ""
    lines = ["Conversación previa:"]
    for turn in history:
        who = "Usuario" if turn.role == "user" else "Asistente"
        lines.append(f"{who}: {turn.text}")
    return "\n".join(lines) + "\n\n"


def build_chat_input(extraction: ExtractionResult, history: list[ChatTurn], question: str) -> list:
    """Arma `[documento, CachePoint(), historial + pregunta]`.

    El `CachePoint` marca el límite del prefijo cacheable: el documento (estable entre turnos)
    se cachea; el historial + pregunta (nuevo cada turno) queda fuera del caché.
    """
    parts: list = [*_doc_parts(extraction), CachePoint()]
    parts.append(f"{_render_history(history)}Pregunta: {question}")
    return parts


def _partial_text(content: object) -> str | None:
    """Texto acumulado de un `content` parcial, solo si es de tipo texto."""
    if content is not None and getattr(content, "content_type", None) == "text":
        return getattr(content, "text", None)
    return None


async def chat_stream(
    model: Model,
    *,
    extraction: ExtractionResult,
    history: list[ChatTurn],
    question: str,
) -> AsyncIterator[ChatEvent]:
    """Streamea la respuesta (texto en vivo) y emite al final el `ChatResponse` ya anclado."""
    with logfire.span("chat.stream"):
        last = ""
        async with chat_agent.run_stream(
            build_chat_input(extraction, history, question), model=model
        ) as result:
            async for partial in result.stream_output():
                text = _partial_text(getattr(partial, "content", None))
                if text and text != last:
                    last = text
                    yield ChatStreamText(text=text)
            answer: ChatAnswer = await result.get_output()

        # Fase 3 determinista: el código valida la cita, no el LLM.
        source, grounding = ground_quote(answer.source_quote, answer.source_page, extraction)
        yield ChatStreamDone(
            response=ChatResponse(content=answer.content, source=source, grounding=grounding)
        )


def _section_brief(section: Section) -> str:
    """Descripción breve de una sección para enfocar las preguntas sugeridas."""
    title = section.title or "(sin título)"
    return f"Sección '{title}' (tipo {section.content.content_type})."


async def generate_suggestions(
    model: Model, *, extraction: ExtractionResult, section: Section
) -> list[str]:
    """Preguntas sugeridas específicas a una sección (relee el documento, cacheado)."""
    with logfire.span("chat.suggestions"):
        parts: list = [*_doc_parts(extraction), CachePoint()]
        parts.append(
            f"{_section_brief(section)}\n\nGenera las preguntas sugeridas para esta sección."
        )
        result = await suggestions_agent.run(parts, model=model)
        return result.output.questions[:3]
