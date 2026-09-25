"""Fase 1 — Extracción y preparación determinista (código, sin LLM).

Maneja dos tipos de fuente:
- Texto plano: se divide en párrafos con offsets (base para el grounding por substring).
- Binario (PDF/imagen): NO se aplana a texto (eso destruiría tablas/diagramas/layout y es
  justo el error del PoC que corrige este hito). Se conserva el binario tal cual para
  pasarlo al modelo como contenido multimodal nativo (Fase 2). La validación de tipo y
  tamaño del archivo vive en `uploads.py`.
"""

import hashlib
import re

from .models import ExtractionResult, Segment

_HAS_NUMBER = re.compile(r"\d")


def _document_id(payload: bytes) -> str:
    return f"doc-{hashlib.sha256(payload).hexdigest()[:12]}"


def _split_segments(text: str) -> list[Segment]:
    """Parte el texto en párrafos conservando sus offsets en el texto ORIGINAL."""
    segments: list[Segment] = []
    index = 0
    for match in re.finditer(r".+?(?:\n\s*\n|$)", text, flags=re.DOTALL):
        raw = match.group()
        stripped = raw.strip()
        if not stripped:
            continue
        start = match.start() + (len(raw) - len(raw.lstrip()))
        end = start + len(stripped)
        segments.append(Segment(index=index, text=stripped, char_start=start, char_end=end))
        index += 1
    return segments


def _prepare_text(text: str) -> ExtractionResult:
    segments = _split_segments(text)
    return ExtractionResult(
        source_kind="text",
        document_id=_document_id(text.encode("utf-8")),
        text=text,
        segments=segments,
        has_numbers=bool(_HAS_NUMBER.search(text)),
        paragraph_count=len(segments),
    )


def _prepare_binary(
    binary: bytes, media_type: str, filename: str | None, instruction: str | None
) -> ExtractionResult:
    source_kind = "pdf" if media_type == "application/pdf" else "image"
    return ExtractionResult(
        source_kind=source_kind,
        document_id=_document_id(binary),
        binary=binary,
        media_type=media_type,
        filename=filename,
        instruction=instruction,
    )


def prepare_input(
    *,
    text: str | None = None,
    binary: bytes | None = None,
    media_type: str | None = None,
    filename: str | None = None,
) -> ExtractionResult:
    """Fase 1: construye el `ExtractionResult` según la fuente.

    Si viene binario, el `text` (si lo hay) se trata como instrucción/contexto que acompaña
    al documento. El endpoint garantiza que llega al menos uno de los dos.
    """
    if binary is not None:
        if media_type is None:
            raise ValueError("media_type es obligatorio cuando se pasa binario")
        return _prepare_binary(binary, media_type, filename, text or None)
    if text:
        return _prepare_text(text)
    raise ValueError("prepare_input requiere texto o binario")
