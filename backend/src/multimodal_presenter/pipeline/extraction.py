"""Fase 1 — Extracción y clasificación determinista (código, sin LLM).

Versión mínima del Hito 2: entrada de texto plano. Prepara el contenido para la Fase 2 y
deja los offsets listos para el grounding de la Fase 3. NO llama al LLM ni decide tipos de
componente (eso es interpretación / Hito 5).

TODO(Hito4): aceptar PDF/imagen como binario multimodal nativo (no aplanar con pypdf).
"""

import hashlib
import re

from .models import ExtractionResult, Segment

_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")
_HAS_NUMBER = re.compile(r"\d")


def _document_id(text: str) -> str:
    """ID estable derivado del contenido (misma entrada → mismo id)."""
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]
    return f"doc-{digest}"


def _split_segments(text: str) -> list[Segment]:
    """Parte el texto en párrafos conservando sus offsets en el texto ORIGINAL."""
    segments: list[Segment] = []
    index = 0
    for match in re.finditer(r".+?(?:\n\s*\n|$)", text, flags=re.DOTALL):
        raw = match.group()
        stripped = raw.strip()
        if not stripped:
            continue
        # Offsets del fragmento no vacío dentro del texto original.
        start = match.start() + (len(raw) - len(raw.lstrip()))
        end = start + len(stripped)
        segments.append(Segment(index=index, text=stripped, char_start=start, char_end=end))
        index += 1
    return segments


def prepare_document(text: str) -> ExtractionResult:
    """Fase 1: convierte texto plano en un `ExtractionResult` estructurado."""
    segments = _split_segments(text)
    return ExtractionResult(
        document_id=_document_id(text),
        text=text,
        segments=segments,
        has_numbers=bool(_HAS_NUMBER.search(text)),
        paragraph_count=len(segments),
    )
