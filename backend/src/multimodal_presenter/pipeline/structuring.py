"""Fase 2 — Estructuración con LLM (PydanticAI + Gemini 3.1 Pro).

El modelo emite un objeto validado contra el contrato del Hito 1 (`output_type=Presentation`);
PydanticAI reintenta automáticamente si la salida no valida. El modelo se pasa en runtime
(`run(model=...)`), no se fija al construir el agente, para que los tests inyecten un modelo
mock sin necesitar clave.

Reparto de responsabilidades (principio rector): el LLM decide lo interpretativo —redacción,
clasificación núcleo/satélite, qué contenido va en cada sección, qué `content_type` encaja—.
Lo determinista (conjunto cerrado de tipos, offsets de fuente) no se le delega: el schema lo
impone y la Fase 3 lo verifica.
"""

from pydantic_ai import Agent
from pydantic_ai.models import Model

from ..schemas import Presentation
from .models import ExtractionResult

SYSTEM_PROMPT = """\
Eres un transformador de información. Recibes el texto de un documento y produces una \
presentación estructurada que reduce la carga cognitiva del lector.

Reglas:
- Divide el contenido en secciones. Cada sección lleva UN tipo de contenido: texto, tabla, \
línea de tiempo (timeline) o gráfico (chart), el que mejor represente honestamente esa \
información. No fuerces un gráfico si los datos no lo justifican.
- Para gráficos, elige chart_type solo del conjunto permitido (line, bar, pie, scatter).
- Clasifica cada sección como 'core' (núcleo: idea esencial, autosuficiente) o 'satellite' \
(satélite: apoyo, matiz, profundidad adicional). El núcleo debe entenderse por sí solo.
- Atribución de fuente OBLIGATORIA y verificable: en cada sección, el campo source.quote \
debe ser un fragmento de texto EXACTO, copiado literalmente del documento de entrada (no \
parafrasees ni inventes). Es lo que permite rastrear cada afirmación a su origen.
- Redacta el contenido en el mismo idioma del documento de entrada.
- No inventes información que no esté en el documento.\
"""


def build_user_prompt(extraction: ExtractionResult) -> str:
    """Construye el prompt de usuario con el documento a estructurar."""
    return (
        f"document_id: {extraction.document_id}\n\n"
        f"--- DOCUMENTO ---\n{extraction.text}\n--- FIN DEL DOCUMENTO ---\n\n"
        "Genera la presentación estructurada de este documento."
    )


# Agente sin modelo fijo: el modelo se inyecta en run(). La instrumentación en Logfire es
# global (logfire.instrument_pydantic_ai() en main.py), no un kwarg del agente.
structuring_agent = Agent(
    output_type=Presentation,
    system_prompt=SYSTEM_PROMPT,
)


async def structure_document(extraction: ExtractionResult, model: Model) -> Presentation:
    """Fase 2: pide al LLM la presentación estructurada validada contra el contrato."""
    result = await structuring_agent.run(build_user_prompt(extraction), model=model)
    return result.output
