"""Validación determinista de archivos subidos (guardas de seguridad, Fase 1).

Cierra los huecos que la auditoría del PoC anterior señaló: tope de tamaño (sin cargar
todo en memoria de golpe), validación de tipo por *magic bytes* reales (no por extensión
ni por el content-type del cliente), y error limpio ante archivos corruptos/vacíos.
"""

import filetype
from fastapi import HTTPException, UploadFile

# Tipos que el modelo procesa de forma multimodal nativa (allowlist; PDF e imágenes que
# Anthropic claude-sonnet-5 admite como BinaryContent).
ALLOWED_MIME: dict[str, str] = {
    "application/pdf": "pdf",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
}

_CHUNK = 1024 * 1024  # 1 MB


async def _read_capped(file: UploadFile, max_bytes: int) -> bytes:
    """Lee el archivo por chunks abortando si supera el tope (evita agotar memoria)."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"El archivo excede el límite de {max_bytes // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def read_and_validate_upload(file: UploadFile, max_bytes: int) -> tuple[bytes, str]:
    """Devuelve (bytes, mime_real) validados. Lanza HTTPException si algo falla.

    El mime se determina por magic bytes, no por la extensión ni el content-type declarado.
    """
    data = await _read_capped(file, max_bytes)
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    kind = filetype.guess(data)
    mime = kind.mime if kind else None
    if mime not in ALLOWED_MIME:
        allowed = ", ".join(sorted(ALLOWED_MIME))
        raise HTTPException(
            status_code=415,
            detail=f"Tipo no permitido ({mime or 'desconocido'}). Permitidos: {allowed}.",
        )
    return data, mime
