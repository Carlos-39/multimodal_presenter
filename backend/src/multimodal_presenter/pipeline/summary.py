"""Adelanto inicial del contenido (Hito 5g).

Un resumen MUY corto de qué contiene lo que el usuario subió, para que sepa a qué se va a
enfrentar antes de ver la presentación estructurada completa. Usa un modelo liviano (Haiku) y
corre en PARALELO al pipeline de streaming (Sonnet) en el frontend: es un adelanto, no un
sustituto. La latencia es la real del LLM; no hay esperas artificiales.
"""

from __future__ import annotations

from pydantic_ai import Agent, BinaryContent
from pydantic_ai.models import Model

from .models import ExtractionResult

_SYSTEM = (
    "Resume en 1-2 frases (máximo ~50 palabras) de qué trata el documento que recibes: su tema "
    "y propósito, para que alguien sepa a qué se va a enfrentar antes de leerlo. Responde en "
    "español, directo, sin preámbulos tipo 'Este documento...', y sin inventar nada que no esté "
    "en el contenido."
)

summary_agent = Agent(system_prompt=_SYSTEM)


async def summarize(model: Model, extraction: ExtractionResult) -> str:
    """Devuelve un adelanto corto (texto plano) del contenido subido."""
    if extraction.source_kind == "text":
        assert extraction.text is not None
        user_input: str | list = extraction.text
    else:
        assert extraction.binary is not None and extraction.media_type is not None
        user_input = [
            "Resume brevemente de qué trata este documento.",
            BinaryContent(data=extraction.binary, media_type=extraction.media_type),
        ]
    result = await summary_agent.run(user_input, model=model)
    return result.output.strip()
