"""Juez de calidad (Hito 7 dry run). Juez = Claude Haiku 4.5.

LIMITACIÓN HONESTA (declarar en el informe): el juez es de la MISMA familia que el generador
(Sonnet), distinta generación/tamaño — no es el ideal cross-vendor (Gemini quedó bloqueado por
acceso). Temperatura 0 y rúbrica fija para reducir varianza.
"""

from __future__ import annotations

import json

from .common import HAIKU, Usage, anthropic_client

_RUBRICA = (
    "Eres un evaluador. Compara la RESPUESTA del sistema con la RESPUESTA DE REFERENCIA para la "
    'PREGUNTA. Devuelve SOLO un JSON: {"correctness": <0.0-1.0>, "nota": "<breve>"}. '
    "correctness=1.0 si la respuesta contiene la información correcta de la referencia; 0.0 si es "
    "incorrecta o inventada; valores intermedios si es parcial. Si la referencia indica que la "
    "pregunta NO es respondible, correctness=1.0 solo si el sistema también dice que no se "
    "encuentra en el documento."
)


async def judge_answer(question: str, reference: str, candidate: str) -> tuple[float, Usage]:
    client = anthropic_client()
    usage = Usage(model=HAIKU)
    # Nota: este SDK de anthropic (1.8.0) no expone `temperature` en messages.create, así que el
    # juez corre con el muestreo por defecto (no temp 0). Limitación menor de determinismo,
    # declarada; para el run escalado se revisa si `output_config` permite fijarla.
    resp = await client.messages.create(
        model=HAIKU,
        max_tokens=256,
        system=_RUBRICA,
        messages=[
            {
                "role": "user",
                "content": (
                    f"PREGUNTA: {question}\n\nRESPUESTA DE REFERENCIA: {reference}\n\n"
                    f"RESPUESTA DEL SISTEMA: {candidate}\n\nEvalúa."
                ),
            }
        ],
    )
    usage.add_anthropic(resp.usage)
    text = "".join(b.text for b in resp.content if b.type == "text")
    try:
        start, end = text.index("{"), text.rindex("}") + 1
        score = float(json.loads(text[start:end]).get("correctness", 0.0))
    except (ValueError, json.JSONDecodeError):
        score = 0.0
    return max(0.0, min(1.0, score)), usage
