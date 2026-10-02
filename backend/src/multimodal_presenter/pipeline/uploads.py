"""Validación determinista de archivos subidos (guardas de seguridad, Fase 1).

Cierra los huecos que la auditoría del PoC anterior señaló: tope de tamaño (sin cargar
todo en memoria de golpe), validación de tipo por *magic bytes* reales (no por extensión
ni por el content-type del cliente), y error limpio ante archivos corruptos/vacíos.

Audio: se admite como documento fuente (lo procesa la Fase 0, ver `pipeline/perception.py`)
con las MISMAS guardas que PDF/imagen, más un tope explícito de DURACIÓN.
"""

import io

import filetype
import mutagen
from fastapi import HTTPException, UploadFile

# Tipos que el modelo procesa de forma multimodal nativa (allowlist; PDF e imágenes que
# Anthropic claude-sonnet-5 admite como BinaryContent).
ALLOWED_MIME: dict[str, str] = {
    "application/pdf": "pdf",
    "image/png": "image",
    "image/jpeg": "image",
    "image/webp": "image",
    # Audio (Fase 0): los formatos que Gemini documenta como entrada acústica nativa.
    "audio/mpeg": "audio",  # MP3
    "audio/wav": "audio",
    "audio/flac": "audio",
    "audio/ogg": "audio",
    "audio/aac": "audio",
    "audio/aiff": "audio",
    # M4A: el formato por defecto de las grabadoras de celular y de buena parte de los
    # podcasts y audiolibros descargables, así que en el uso real es de los más probables.
    # Gemini lo admite, pero SOLO con el nombre `audio/m4a` (ver `_CANONICAL_MIME`).
    # Salvedad declarada: la ruta de CONTINGENCIA (OpenRouter) no lo soporta — PydanticAI no
    # tiene M4A en su mapa de formatos de audio y lanza `Unknown media type`. Con la ruta
    # primaria (Google) no hay problema: `GoogleModel` pasa el media_type tal cual a
    # `inline_data`, sin consultar ese mapa. `perception_route` permite avisar antes de fallar.
    "audio/m4a": "audio",
}

# `filetype` reporta nombres que los modelos no reconocen: las variantes `x-` de tres
# formatos, y `audio/mp4` para el contenedor M4A (Gemini lo quiere como `audio/m4a`). Se
# normalizan ANTES de decidir si el tipo es admisible. El camino PDF/imagen no necesitaba
# esto porque ahí los nombres ya coinciden.
_CANONICAL_MIME: dict[str, str] = {
    "audio/x-wav": "audio/wav",
    "audio/x-flac": "audio/flac",
    "audio/x-aiff": "audio/aiff",
    "audio/mp4": "audio/m4a",
    "audio/x-m4a": "audio/m4a",
}

_CHUNK = 1024 * 1024  # 1 MB

# Valor de respaldo, solo para llamadas directas desde tests: el endpoint pasa SIEMPRE el
# configurado (`settings.max_audio_minutes`), que es la fuente de verdad.
DEFAULT_MAX_AUDIO_SECONDS = 15 * 60


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


def audio_duration_seconds(data: bytes) -> float:
    """Duración del audio en segundos. Lanza HTTPException(400) si no se puede leer.

    `mutagen` es Python puro (sin ffmpeg ni binarios externos) y cubre los seis formatos
    de la allowlist. Si el archivo pasó los magic bytes pero su cabecera está corrupta, la
    duración no se puede saber: se rechaza con un error claro en vez de dejar pasar un
    archivo sin medir (el tope de duración no puede fallar en silencio).
    """
    try:
        probe = mutagen.File(io.BytesIO(data))
    except mutagen.MutagenError as exc:
        raise HTTPException(
            status_code=400, detail="El audio está corrupto o su cabecera no se pudo leer."
        ) from exc
    # OJO: hay que comparar con None. Un archivo sin etiquetas es *falsy* (mutagen expone
    # las tags como mapa), así que un `if not probe` descartaría audios perfectamente válidos.
    if probe is None or probe.info is None or not probe.info.length:
        raise HTTPException(status_code=400, detail="No se pudo determinar la duración del audio.")
    return float(probe.info.length)


async def read_and_validate_upload(
    file: UploadFile,
    max_bytes: int,
    *,
    max_audio_seconds: int = DEFAULT_MAX_AUDIO_SECONDS,
) -> tuple[bytes, str]:
    """Devuelve (bytes, mime_canónico) validados. Lanza HTTPException si algo falla.

    El mime se determina por magic bytes, no por la extensión ni el content-type declarado,
    y se normaliza a su forma canónica (ver `_CANONICAL_MIME`). Para audio se valida además
    la DURACIÓN: los modelos de audio pierden fiabilidad en grabaciones largas, así que el
    prototipo se acota explícitamente y lo dice (413 con la duración real y el límite).
    """
    data = await _read_capped(file, max_bytes)
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    kind = filetype.guess(data)
    detected = kind.mime if kind else None
    mime = _CANONICAL_MIME.get(detected, detected) if detected else None
    if mime not in ALLOWED_MIME:
        allowed = ", ".join(sorted(ALLOWED_MIME))
        raise HTTPException(
            status_code=415,
            detail=f"Tipo no permitido ({detected or 'desconocido'}). Permitidos: {allowed}.",
        )

    if ALLOWED_MIME[mime] == "audio":
        seconds = audio_duration_seconds(data)
        if seconds > max_audio_seconds:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"El audio dura {seconds / 60:.1f} min y el límite es "
                    f"{max_audio_seconds // 60} min. Recórtalo y vuelve a subirlo."
                ),
            )
    return data, mime
