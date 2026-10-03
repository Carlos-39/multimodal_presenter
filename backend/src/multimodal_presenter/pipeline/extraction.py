"""Fase 1 — Extracción y preparación determinista (código, sin LLM).

Maneja tres tipos de fuente:
- Texto plano: se divide en párrafos con offsets (base para el grounding por substring).
- Binario (PDF/imagen): NO se aplana a texto (eso destruiría tablas/diagramas/layout y es
  justo el error del PoC que corrige este hito). Se conserva el binario tal cual para
  pasarlo al modelo como contenido multimodal nativo (Fase 2). La validación de tipo y
  tamaño del archivo vive en `uploads.py`.
- Audio: tampoco se aplana con un STT. Lo percibe la Fase 0 (`perception.py`) con un modelo
  de entrada acústica nativa, y aquí llega ya como `AudioEvidence`. El binario se conserva
  igualmente, porque sigue siendo la fuente real a la que apunta la atribución.
"""

import hashlib
import re

from ..schemas.audio import AudioEvidence
from .models import ExtractionResult, Segment

_HAS_NUMBER = re.compile(r"\d")


def compute_document_id(payload: bytes) -> str:
    """Id DIRECCIONABLE POR CONTENIDO de un documento: el mismo contenido da el mismo id.

    Es público porque el almacén de documentos (`storage.documents`) lo necesita para comprobar
    que unos bytes se guardan bajo el id que de verdad les corresponde. Que la regla viva en un
    solo sitio es lo que hace que esa comprobación signifique algo.
    """
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
        document_id=compute_document_id(text.encode("utf-8")),
        text=text,
        segments=segments,
        has_numbers=bool(_HAS_NUMBER.search(text)),
        paragraph_count=len(segments),
    )


def _source_kind(media_type: str) -> str:
    if media_type == "application/pdf":
        return "pdf"
    if media_type.startswith("audio/"):
        return "audio"
    return "image"


def _prepare_binary(
    binary: bytes,
    media_type: str,
    filename: str | None,
    instruction: str | None,
    audio_evidence: AudioEvidence | None,
) -> ExtractionResult:
    return ExtractionResult(
        source_kind=_source_kind(media_type),  # type: ignore[arg-type]
        document_id=compute_document_id(binary),
        binary=binary,
        media_type=media_type,
        filename=filename,
        instruction=instruction,
        audio_evidence=audio_evidence,
    )


def prepare_input(
    *,
    text: str | None = None,
    binary: bytes | None = None,
    media_type: str | None = None,
    filename: str | None = None,
    audio_evidence: AudioEvidence | None = None,
) -> ExtractionResult:
    """Fase 1: construye el `ExtractionResult` según la fuente.

    Si viene binario, el `text` (si lo hay) se trata como instrucción/contexto que acompaña
    al documento. El endpoint garantiza que llega al menos uno de los dos.

    `audio_evidence` es lo que produjo la Fase 0 cuando la fuente es audio. Esta función
    sigue siendo DETERMINISTA y sin LLM (la percepción ocurre antes, en su propia fase):
    aquí solo se guarda lo ya percibido. El `document_id` se calcula sobre el audio ORIGINAL,
    no sobre la evidencia, para que identifique la fuente real.
    """
    if binary is not None:
        if media_type is None:
            raise ValueError("media_type es obligatorio cuando se pasa binario")
        if media_type.startswith("audio/") and audio_evidence is None:
            raise ValueError(
                "una fuente de audio exige el `audio_evidence` de la Fase 0 "
                "(el motor de estructuración no admite audio como entrada)"
            )
        return _prepare_binary(binary, media_type, filename, text or None, audio_evidence)
    if text:
        return _prepare_text(text)
    raise ValueError("prepare_input requiere texto o binario")
