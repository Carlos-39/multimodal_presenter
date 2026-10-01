"""Juez de calidad (Hito 7 dry run). Juez = Haiku 4.5 (Anthropic).

LIMITACIÓN HONESTA (declarar en el informe): el juez es de la MISMA familia que el generador
(Sonnet), distinta generación/tamaño — no es el ideal cross-vendor (Gemini quedó bloqueado por
acceso). Temperatura 0 y rúbrica fija para reducir varianza.
"""

from __future__ import annotations

import json

from .common import HAIKU, Usage, anthropic_client

UNANSWERABLE = "unanswerable"


def apply_unanswerable_gate(
    category: str, condition: str, retrieved_pages: list[int], judge_score: float
) -> float:
    """Corrección post-auditoría (Hito 7): endurece la métrica de `unanswerable`.

    La auditoría del dataset encontró que la categoría premiaba el FALLO de recuperación:
    `lightrag_graph` sacaba 1.0 abstenéndose ("No se encuentra") tras recuperar CERO páginas
    (`retrieved_pages == []`) — el mismo modo de fallo catastrófico que le da ~0.3 en el resto.
    "No recuperé nada, luego no está" NO puede puntuar igual que "recuperé y verifiqué la ausencia".

    Regla: en `unanswerable`, la abstención solo cuenta si hubo contexto que inspeccionar.
    - `baseline` está EXENTO: recibe el documento completo (su `retrieved_pages=[]` es una
      convención de logging, no una falla de recuperación).
    - Condiciones con recuperación: exigen `retrieved_pages != []`; si no, correctness = 0.0.
    Fuera de `unanswerable` no cambia nada (devuelve el puntaje del juez tal cual).
    """
    if category != UNANSWERABLE:
        return judge_score
    retrieval_ok = condition == "baseline" or len(retrieved_pages) > 0
    return judge_score if retrieval_ok else 0.0


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
