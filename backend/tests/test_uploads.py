"""Tests de las guardas de seguridad de subida (validación determinista, sin modelo)."""

import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile

from multimodal_presenter.pipeline.uploads import read_and_validate_upload

from .conftest import make_wav


def _upload(data: bytes, filename: str = "x") -> UploadFile:
    return UploadFile(file=io.BytesIO(data), filename=filename)


def test_accepts_pdf(pdf_bytes: bytes) -> None:
    data, mime = asyncio.run(read_and_validate_upload(_upload(pdf_bytes), 1024 * 1024))
    assert mime == "application/pdf"
    assert data == pdf_bytes


def test_accepts_png(png_bytes: bytes) -> None:
    _data, mime = asyncio.run(read_and_validate_upload(_upload(png_bytes), 1024 * 1024))
    assert mime == "image/png"


def test_rejects_unknown_type_by_magic_bytes() -> None:
    # Aunque el nombre diga .pdf, los magic bytes no lo son → rechazo (no confía en extensión).
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            read_and_validate_upload(_upload(b"texto plano cualquiera", "falso.pdf"), 1024 * 1024)
        )
    assert exc.value.status_code == 415


def test_rejects_oversize(pdf_bytes: bytes) -> None:
    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_and_validate_upload(_upload(pdf_bytes), max_bytes=10))
    assert exc.value.status_code == 413


def test_rejects_empty() -> None:
    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_and_validate_upload(_upload(b""), 1024 * 1024))
    assert exc.value.status_code == 400


# ─────────────────────────────────────────────────────────────
# Audio como documento fuente (Fase 0)
# ─────────────────────────────────────────────────────────────
def test_accepts_audio_and_canonicalizes_the_mime(wav_bytes: bytes) -> None:
    """`filetype` dice `audio/x-wav`; el modelo necesita `audio/wav`."""
    data, mime = asyncio.run(read_and_validate_upload(_upload(wav_bytes, "clip.wav"), 10**7))
    assert mime == "audio/wav"
    assert data == wav_bytes


def test_rejects_audio_longer_than_the_limit() -> None:
    largo = make_wav(seconds=12)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            read_and_validate_upload(_upload(largo, "largo.wav"), 10**7, max_audio_seconds=10)
        )
    assert exc.value.status_code == 413
    # El error dice la duración real y el límite: explícito, no un fallo silencioso.
    assert "0.2 min" in exc.value.detail
    assert "límite" in exc.value.detail


def test_accepts_audio_exactly_at_the_limit() -> None:
    data, mime = asyncio.run(
        read_and_validate_upload(_upload(make_wav(10), "justo.wav"), 10**7, max_audio_seconds=10)
    )
    assert mime == "audio/wav"


def test_rejects_audio_with_unreadable_header(wav_bytes: bytes) -> None:
    # WAV truncado: pasa los magic bytes (RIFF/WAVE) pero ya no tiene cabecera que medir →
    # se rechaza, en vez de dejar pasar un audio sin medir y saltarse el tope de duración.
    with pytest.raises(HTTPException) as exc:
        asyncio.run(read_and_validate_upload(_upload(wav_bytes[:16], "roto.wav"), 10**7))
    assert exc.value.status_code == 400
    assert "corrupto" in exc.value.detail


def test_rejects_m4a_explicitly(wav_bytes: bytes) -> None:
    """M4A queda fuera de la allowlist a propósito (no está documentado para Gemini ni
    mapeado por PydanticAI). Se comprueba que `audio/mp4` no es admisible."""
    from multimodal_presenter.pipeline.uploads import ALLOWED_MIME

    assert "audio/mp4" not in ALLOWED_MIME
