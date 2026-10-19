"""Chat anclado a fuentes (Hito 6).

Arquitectura (decidida en Fase 2, no se reabre): cada turno RELEE el documento ORIGINAL
completo: nunca busca sobre la `Presentation` (que es una selección núcleo/satélite y perdería
contenido). Para no reprocesar el documento en cada turno se usa **prompt caching** de Anthropic
vía `CachePoint`: el documento va antes del marcador y queda cacheado; cada pregunta solo procesa
lo nuevo (historial + pregunta).

Anclaje: el LLM aporta la cita (`source_quote`); el código la valida con la MISMA regla
determinista de la Fase 3 (`ground_quote`). Si no se puede anclar, se dice con honestidad, no
se fabrica una fuente (mismo espíritu que `not_found` en 5c).
"""

from collections.abc import AsyncIterator

import logfire
from pydantic_ai import Agent, BinaryContent, CachePoint, PromptedOutput, ToolOutput
from pydantic_ai.exceptions import UnexpectedModelBehavior
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
from .estilo import SIN_MARKDOWN
from .models import ExtractionResult
from .pdf_locator import abrir_localizador
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
- Responde en el idioma del documento y la pregunta.
- {SIN_MARKDOWN}

Aclaración ante ambigüedad (úsala con MUCHA moderación; por defecto RESPONDE):
- Antes de responder, evalúa si la pregunta es GENUINAMENTE ambigua de un modo que CAMBIARÍA la \
respuesta. Pide aclaración SOLO si: (a) tiene un referente poco claro que el historial no \
resuelve ("¿y el otro?", "¿eso cómo va?" sin antecedente claro), o (b) admite dos lecturas \
realmente distintas con respuestas ancladas distintas.
- NO pidas aclaración por preguntas simplemente cortas, informales, con errores de tipeo, o que \
tienen una interpretación razonable: en esos casos RESPONDE. Ante la duda, RESPONDE.
- Pide aclaración A LO SUMO UNA VEZ: si tu turno ANTERIOR en el historial ya fue un pedido de \
aclaración, esta vez RESPONDE con la mejor interpretación, no vuelvas a preguntar.
- Para pedir aclaración: llena `clarification` con una `question` breve y de cortesía (1 frase) y \
1-2 `options` concretas (las interpretaciones posibles). Cuando la llenes, deja `source_quote` en \
null y pon en `content.text` la MISMA pregunta de aclaración (sin inventar una respuesta).\
""".replace("{SIN_MARKDOWN}", SIN_MARKDOWN)

_SUGGESTIONS_PROMPT = """\
Genera entre 2 y 3 preguntas breves y ESPECÍFICAS que un lector se haría para profundizar en la \
sección indicada, todas respondibles desde el documento. Nada de preguntas genéricas ("¿de qué \
trata?"). Devuelve solo las preguntas.\
"""

#: El chat responde rellenando los argumentos de una herramienta, no escribiendo JSON dentro de
#: texto libre, y ese cambio ataca una causa concreta medida en producción.
#:
#: Con `PromptedOutput` el modelo tiene que acordarse de envolver su respuesta en un JSON válido, y
#: en las preguntas ESCRITAS fallaba casi siempre: «Invalid JSON: expected value». Las sugeridas no
#: fallaban nunca. La diferencia entre unas y otras es que las escritas son cortas y a menudo
#: ambiguas (cuatro, diez, diecinueve caracteres), y ante una pregunta así el modelo tiende a
#: contestar conversando, que es exactamente salirse del sobre. Cada una costaba dos llamadas,
#: porque el reintento sin streaming la salvaba.
#:
#: Con una herramienta no hay sobre del que salirse: el esquema lo impone la API. Comprobado que el
#: streaming de texto parcial se mantiene idéntico, que es lo único que se podía perder.
#:
#: El resto de agentes sigue con `PromptedOutput` a propósito: ninguno ha dado este fallo, y
#: cambiarlos todos a la vez en vísperas de las sesiones es mover lo que funciona.
chat_agent = Agent(output_type=ToolOutput(ChatAnswer), system_prompt=_CHAT_PROMPT)
suggestions_agent = Agent(
    output_type=PromptedOutput(SuggestionsResponse), system_prompt=_SUGGESTIONS_PROMPT
)


_AUDIO_NOTE = """\
El documento es un AUDIO. No recibes la señal: recibes la anotación estructurada que un modelo \
con entrada acústica produjo al escucharla (el motor que responde no admite audio). Para \
responder:
- `segments[].text` es lo que se dijo: ahí está el contenido.
- Si `speaker_count > 1`, ATRIBUYE cada afirmación a su hablante y usa las etiquetas tal cual \
("hablante 1"). Si preguntan quién dijo algo, la respuesta está en el `speaker` del segmento.
- `emphasis` es lo que se remarcó al hablar, y `delivery: "dubitativo"` o `confidence: "baja"` \
señalan algo dicho con duda: si de ahí sale una cifra, preséntala matizada, nunca como firme.
- `acoustic_context.at_risk_items` enumera lo que el audio no dejó claro: dilo si es relevante.
- `source_quote` debe ser un fragmento LITERAL de algún `segments[].text`. No cites la anotación \
ni inventes texto. Deja `source_page` en null (el audio no tiene páginas).\
"""


def _doc_parts(extraction: ExtractionResult) -> list[str | BinaryContent]:
    """El documento como partes de prompt: texto, binario nativo (PDF/imagen) o evidencia (audio).

    El audio NO viaja como binario aquí: el motor del chat es el mismo de la estructuración y
    tampoco admite audio. Relee la MISMA `AudioEvidence` que produjo la Fase 0 (la reenvía el
    frontend), así que el documento es idéntico en todos los turnos y no se vuelve a percibir
    nada: ni se paga de nuevo, ni la anotación cambia entre preguntas.
    """
    if extraction.source_kind == "text":
        assert extraction.text is not None
        return [f"--- DOCUMENTO ---\n{extraction.text}\n--- FIN DEL DOCUMENTO ---"]
    if extraction.source_kind == "audio":
        assert extraction.audio_evidence is not None
        evidencia = extraction.audio_evidence.model_dump_json(indent=2)
        return [
            f"{_AUDIO_NOTE}\n\n--- EVIDENCIA ACÚSTICA (JSON) ---\n{evidencia}\n"
            "--- FIN DE LA EVIDENCIA ---"
        ]
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
        entrada = build_chat_input(extraction, history, question)
        last = ""
        answer: ChatAnswer
        try:
            async with chat_agent.run_stream(entrada, model=model) as result:
                async for partial in result.stream_output():
                    text = _partial_text(getattr(partial, "content", None))
                    if text and text != last:
                        last = text
                        yield ChatStreamText(text=text)
                answer = await result.get_output()
        except UnexpectedModelBehavior as exc:
            # «Output validation failed during streaming, and retries are not supported in
            # `run_stream()`». Es un límite de la biblioteca, no un fallo del modelo ni de la red:
            # cuando la salida no encaja con `ChatAnswer`, el camino normal es devolvérsela al
            # modelo para que la corrija, y ese reintento NO existe mientras se streamea. El turno
            # moría ahí y el participante veía «la generación se interrumpió».
            #
            # Así que se rehace el turno sin streaming, que sí reintenta. Se pierde el efecto de
            # escritura de ESE turno y se paga una llamada más; a cambio hay respuesta en vez de
            # un error. Lo que se emitió antes del fallo lo reemplaza el evento final.
            #
            # La causa va DENTRO del mensaje, entre llaves, y no como atributo suelto: sin token
            # de Logfire los registros salen por la consola, y ahí solo se imprime el mensaje ya
            # formateado. Un atributo que nadie va a leer es como no haberlo escrito, pasó: la
            # primera versión de esta línea puso la causa al lado y en Railway no apareció.
            #
            # Hace falta porque el mensaje de pydantic-ai dice QUÉ pasó pero no en qué campo, y
            # sin eso no se distingue entre que el modelo se inventara una clave de más, que se
            # pasara de opciones en la aclaración o que devolviera un `content` que no encaja con
            # ninguna rama de la unión.
            logfire.warn(
                "chat: la validación falló en streaming; se rehace sin streaming. Causa: {causa}",
                causa=repr(exc.__cause__ or exc)[:500],
            )
            answer = (await chat_agent.run(entrada, model=model)).output

        # Opción D: si el LLM pide aclaración, este turno NO es una respuesta anclada.
        if answer.clarification is not None:
            yield ChatStreamDone(
                response=ChatResponse(
                    content=answer.content,
                    source=None,
                    grounding="not_found",
                    clarification=answer.clarification,
                )
            )
            return

        # Fase 3 determinista: el código valida la cita, no el LLM. El localizador se abre aquí
        # y muere aquí: una respuesta de chat ancla UNA cita, así que no hay nada que reusar.
        with abrir_localizador(extraction.source_kind, extraction.binary) as localizador:
            ancla = ground_quote(answer.source_quote, answer.source_page, extraction, localizador)
        yield ChatStreamDone(
            response=ChatResponse(
                content=answer.content,
                source=ancla.source,
                grounding=ancla.status,
                start_s=ancla.start_s,
                region=ancla.region,
            )
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
