"""Tests de las guardas de seguridad de subida (validación determinista, sin modelo)."""

import asyncio
import io

import pytest
from fastapi import HTTPException, UploadFile

from multimodal_presenter.pipeline.uploads import read_and_validate_upload


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
