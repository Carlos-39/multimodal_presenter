"""Fase 2: Estructuración con LLM (PydanticAI + Anthropic claude-sonnet-5).

El modelo emite un objeto validado contra el contrato (`Presentation`), con reintentos
automáticos. El documento entra como texto o como BINARIO multimodal nativo (PDF/imagen vía
`BinaryContent`): nunca como texto extraído de un binario.

Modo de salida: `PromptedOutput` (el modelo escribe el JSON como su respuesta de texto y
PydanticAI lo parsea). Se eligió sobre `ToolOutput` porque el streaming (Hito 5d) necesita
parciales incrementales: con `ToolOutput` la salida viaja como los argumentos de una tool
call que PydanticAI solo resuelve al completarse, así que `stream_output()` no emite nada
hasta el final (todas las secciones de golpe). Con `PromptedOutput` el JSON se transmite como
texto token a token y `stream_output()` expone `Presentation` parciales → secciones una por
una. El mismo agente sirve a `/transform` (no-streaming) y `/transform/stream` para que ambos
caminos se comporten igual. Verificado empíricamente en el Hito 5d.

Principio rector: el LLM decide lo interpretativo (redacción, núcleo/satélite, content_type,
qué página citar). Lo determinista (tipos cerrados, validación de archivo, offsets de texto)
va en código.
"""

from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models import Model

from ..schemas import Presentation
from .models import ExtractionResult

SYSTEM_PROMPT = """\
Eres un transformador de información. Recibes un documento (texto, PDF o imagen) y produces \
una presentación estructurada que reduce la carga cognitiva del lector.

Reglas:
- Divide el contenido en secciones. Cada sección lleva UN tipo de contenido: texto, tabla, \
línea de tiempo (timeline) o gráfico (chart), el que represente honestamente esa información. \
No fuerces un gráfico si los datos no lo justifican.
- Para gráficos, elige chart_type solo del conjunto permitido (line, bar, pie, scatter).
- Clasifica cada sección como 'core' (núcleo: idea esencial, autosuficiente) o 'satellite' \
(satélite: apoyo, matiz).
- Atribución de fuente OBLIGATORIA en cada sección (campo source):
  · source.quote: un fragmento textual breve del documento que respalda la sección.
  · Si el documento es un PDF, indica en source.page el número de página (empezando en 1) \
de donde proviene la afirmación.
- Si además del documento recibes una instrucción del usuario, respétala al decidir el \
enfoque y el énfasis, sin inventar información que no esté en el documento.
- Redacta en el mismo idioma del documento.\
"""


# Instrucciones de uso de la evidencia acústica. Van en el PROMPT DE USUARIO, no en el
# SYSTEM_PROMPT: así la Fase 2 es exactamente la de siempre para texto/PDF/imagen (el system
# prompt compartido no cambia ni una palabra) y el audio solo añade contexto a su propia
# llamada. Lo que estas reglas hacen es convertir los rasgos paralingüísticos en decisiones de
# presentación concretas: qué destacar, qué cifras matizar y a quién atribuir cada idea.
_AUDIO_GUIDE = """\
La fuente de este documento es un AUDIO. No recibes la señal: recibes una anotación \
estructurada que un modelo con entrada acústica produjo al escucharla. Úsala así:
- `segments[].text` es lo que se dijo: ese es tu contenido.
- `segments[].emphasis` es lo que el hablante REMARCÓ al hablar → candidato a sección `core`, \
a título, o a ir primero.
- `delivery == "dubitativo"`, `pause_before == "larga"` o `confidence == "baja"` señalan algo \
dicho con duda: si de ahí sale una cifra, preséntala matizada ("alrededor de", "según el \
hablante, aproximadamente") y NUNCA como dato firme.
- `acoustic_context.at_risk_items` enumera cifras o nombres que el audio no dejó claros: \
matízalos explícitamente, o no los uses como el dato central de una sección.
- Si `speaker_count > 1`, ATRIBUYE cada idea a su hablante (usa las etiquetas tal cual). No \
fundas en una sola voz lo que dijeron dos.
- `perceived_structure` sugiere dónde cortar secciones: es pista, no obligación.
- `non_verbal_events` es contexto; rara vez es el contenido de una sección.
- `source.quote` debe ser un fragmento LITERAL de algún `segments[].text`. No cites la \
anotación ni inventes texto. Deja `source.page` en null (el audio no tiene páginas).\
"""


def _text_prompt(text: str, document_id: str) -> str:
    return (
        f"document_id: {document_id}\n\n"
        f"--- DOCUMENTO ---\n{text}\n--- FIN DEL DOCUMENTO ---\n\n"
        "Genera la presentación estructurada de este documento."
    )


def _audio_prompt(extraction: ExtractionResult) -> str:
    assert extraction.audio_evidence is not None
    evidence = extraction.audio_evidence.model_dump_json(indent=2)
    instruction = extraction.instruction
    extra = f"\n\nInstrucción del usuario: {instruction}" if instruction else ""
    return (
        f"document_id: {extraction.document_id}\n\n"
        f"{_AUDIO_GUIDE}\n\n"
        f"--- EVIDENCIA ACÚSTICA (JSON) ---\n{evidence}\n--- FIN DE LA EVIDENCIA ---\n\n"
        f"Genera la presentación estructurada de este audio.{extra}"
    )


def build_model_input(extraction: ExtractionResult) -> str | list[str | BinaryContent]:
    """Construye el input para el modelo: string (texto) o lista con BinaryContent (binario).

    Es el punto exacto donde el binario debe llegar bien formado al modelo.
    """
    if extraction.source_kind == "text":
        assert extraction.text is not None
        return _text_prompt(extraction.text, extraction.document_id)

    if extraction.source_kind == "audio":
        # El audio NO llega como binario a esta fase: Sonnet no admite audio como modalidad
        # de entrada. Entra la `AudioEvidence` de la Fase 0, que conserva hablantes, énfasis,
        # pausas y condiciones acústicas: no una transcripción plana.
        return _audio_prompt(extraction)

    assert extraction.binary is not None and extraction.media_type is not None
    instruction = extraction.instruction or "Genera la presentación estructurada de este documento."
    return [
        f"{instruction}\n\ndocument_id: {extraction.document_id}",
        BinaryContent(data=extraction.binary, media_type=extraction.media_type),
    ]


structuring_agent = Agent(
    output_type=PromptedOutput(Presentation),
    system_prompt=SYSTEM_PROMPT,
)


async def structure_document(extraction: ExtractionResult, model: Model) -> Presentation:
    """Fase 2: pide al LLM la presentación estructurada validada contra el contrato."""
    result = await structuring_agent.run(build_model_input(extraction), model=model)
    return result.output
