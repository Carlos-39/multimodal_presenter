"""Transcripción página→texto (Haiku) para alimentar el índice de LightRAG (Hito 7).

Esta es la tensión "aplanar SOLO en el índice": el grafo de LightRAG se construye sobre texto,
así que se transcribe cada página (texto + descripción de tablas/figuras) con Haiku. La respuesta
final NUNCA usa este texto: usa las páginas nativas. Cada página se marca con `[PÁGINA N]` para
poder mapear después los chunks recuperados de vuelta a su página.
"""

from __future__ import annotations

import base64

from .common import HAIKU, Usage, anthropic_client, page_count, render_page_png

_SYSTEM = (
    "Transcribe el contenido de esta página de un documento: todo el texto tal cual, y además "
    "describe las tablas (con sus valores) y las figuras/gráficos (qué muestran y sus datos). "
    "No agregues información que no esté en la página. Responde solo con la transcripción."
)


async def transcribe_pages(pdf_bytes: bytes) -> tuple[str, dict[int, str], Usage]:
    """Devuelve (texto_completo_con_marcadores, {pagina: texto}, uso)."""
    client = anthropic_client()
    usage = Usage(model=HAIKU)
    n = page_count(pdf_bytes)
    per_page: dict[int, str] = {}
    parts: list[str] = []

    for i in range(n):
        png = render_page_png(pdf_bytes, i)
        b64 = base64.standard_b64encode(png).decode("ascii")
        message = await client.messages.create(
            model=HAIKU,
            max_tokens=2048,
            system=_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/png", "data": b64},
                        },
                        {"type": "text", "text": "Transcribe esta página."},
                    ],
                }
            ],
        )
        usage.add_anthropic(message.usage)
        text = "".join(b.text for b in message.content if b.type == "text").strip()
        page_no = i + 1
        per_page[page_no] = text
        parts.append(f"[PÁGINA {page_no}]\n{text}")

    return "\n\n".join(parts), per_page, usage
