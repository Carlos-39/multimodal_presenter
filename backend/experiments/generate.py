"""Generador de respuesta ÚNICO y compartido por las 4 condiciones (Hito 7).

Restricción clave del experimento: el generador (Claude Sonnet 5) y el prompt son los MISMOS en
las 4 condiciones — solo cambia qué páginas (nativas: PDF/imagen) recibe. Nunca texto aplanado.
El documento va con `cache_control` para que el baseline (mismo documento cada pregunta) se
beneficie del prompt caching, y ese ahorro quede medido igual que en el Hito 6.
"""

from __future__ import annotations

import base64

from .common import SONNET, Usage, anthropic_client

_SYSTEM = (
    "Responde la pregunta USANDO ÚNICAMENTE las páginas del documento que se te entregan. "
    "No uses conocimiento externo ni inventes. Si la respuesta no está en esas páginas, dilo "
    "explícitamente ('No se encuentra en el documento'). Sé conciso y cita los datos tal como "
    "aparecen."
)


async def generate_answer(pages_pdf: bytes, question: str) -> tuple[str, Usage]:
    """Genera la respuesta con Sonnet a partir de páginas NATIVAS (PDF). Devuelve (texto, uso)."""
    client = anthropic_client()
    b64 = base64.standard_b64encode(pages_pdf).decode("ascii")
    message = await client.messages.create(
        model=SONNET,
        max_tokens=1024,
        system=_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
                        "cache_control": {"type": "ephemeral"},
                    },
                    {"type": "text", "text": f"Pregunta: {question}"},
                ],
            }
        ],
    )
    usage = Usage(model=SONNET)
    usage.add_anthropic(message.usage)
    text = "".join(block.text for block in message.content if block.type == "text")
    return text, usage
