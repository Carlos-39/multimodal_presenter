"""Fase 2 — Estructuración con LLM (PydanticAI + Gemini 3.1 Pro).

El modelo emite un objeto validado contra el contrato (`output_type=Presentation`), con
reintentos automáticos. El documento entra como texto o como BINARIO multimodal nativo
(PDF/imagen vía `BinaryContent`) — nunca como texto extraído de un binario.

Principio rector: el LLM decide lo interpretativo (redacción, núcleo/satélite, content_type,
qué página citar). Lo determinista (tipos cerrados, validación de archivo, offsets de texto)
va en código.
"""

from pydantic_ai import Agent, BinaryContent, ToolOutput
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


def _text_prompt(text: str, document_id: str) -> str:
    return (
        f"document_id: {document_id}\n\n"
        f"--- DOCUMENTO ---\n{text}\n--- FIN DEL DOCUMENTO ---\n\n"
        "Genera la presentación estructurada de este documento."
    )


def build_model_input(extraction: ExtractionResult) -> str | list[str | BinaryContent]:
    """Construye el input para el modelo: string (texto) o lista con BinaryContent (binario).

    Es el punto exacto donde el binario debe llegar bien formado al modelo.
    """
    if extraction.source_kind == "text":
        assert extraction.text is not None
        return _text_prompt(extraction.text, extraction.document_id)

    assert extraction.binary is not None and extraction.media_type is not None
    instruction = extraction.instruction or "Genera la presentación estructurada de este documento."
    return [
        f"{instruction}\n\ndocument_id: {extraction.document_id}",
        BinaryContent(data=extraction.binary, media_type=extraction.media_type),
    ]


structuring_agent = Agent(
    output_type=ToolOutput(Presentation),
    system_prompt=SYSTEM_PROMPT,
)


async def structure_document(extraction: ExtractionResult, model: Model) -> Presentation:
    """Fase 2: pide al LLM la presentación estructurada validada contra el contrato."""
    result = await structuring_agent.run(build_model_input(extraction), model=model)
    return result.output
