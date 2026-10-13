"""Explicación bajo demanda de una imagen REAL del documento (Hito 5h Parte 3).

NO genera nada nuevo: es una vía de acceso directa a una capacidad ya construida — el documento se
procesa como binario nativo (Hito 4, el modelo "ve" la imagen real). Se le pide al modelo que
explique, en lenguaje accesible, lo que muestra una imagen/figura del documento (un diagrama, una
estructura, una gráfica compleja). La explicación trata sobre la imagen real, así que su atribución
es la propia imagen (se renderiza justo debajo de ella en el `SourcePanel`); no lleva etiqueta de
"no verificable" (eso es solo para las ilustraciones generadas de la Parte 1, que es otra cosa).
"""

from __future__ import annotations

from pydantic_ai import Agent, BinaryContent
from pydantic_ai.models import Model

from .estilo import SIN_MARKDOWN
from .models import ExtractionResult

_SYSTEM = (
    "Explica en lenguaje accesible qué muestra la imagen o figura del documento que recibes: qué "
    "representa, cuáles son sus partes y cómo leerla, para que alguien que no la entiende de un "
    "vistazo pueda comprenderla. Si es un diagrama, una estructura o una gráfica, descríbela "
    "paso a paso. Español claro y directo. No inventes nada que no se vea en la imagen. "
    + SIN_MARKDOWN
)

explain_agent = Agent(system_prompt=_SYSTEM)


async def explain_image(
    model: Model,
    extraction: ExtractionResult,
    *,
    page: int | None = None,
    context: str | None = None,
) -> str:
    """Explicación en texto de la imagen real del documento (fuente binaria: PDF o imagen)."""
    assert extraction.binary is not None and extraction.media_type is not None
    prompt = "Explica qué muestra esta imagen del documento."
    if page is not None:
        prompt += f" Enfócate en la página {page}."
    if context:
        prompt += f" La sección que la acompaña trata de: {context}."
    user_input = [
        prompt,
        BinaryContent(data=extraction.binary, media_type=extraction.media_type),
    ]
    result = await explain_agent.run(user_input, model=model)
    return result.output.strip()
