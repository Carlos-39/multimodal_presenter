"""Endpoint que dibuja una página del PDF (F3) — el que alimenta el visor con recuadro."""

from __future__ import annotations

import pathlib

import matplotlib
import pytest
from fastapi.testclient import TestClient
from fpdf import FPDF

from multimodal_presenter.main import app

_TTF = pathlib.Path(matplotlib.get_data_path()) / "fonts" / "ttf" / "DejaVuSans.ttf"


@pytest.fixture(scope="module")
def pdf_dos_paginas() -> bytes:
    pdf = FPDF(unit="pt", format="A4")
    pdf.add_font("dejavu", "", str(_TTF))
    pdf.set_font("dejavu", size=11)
    for n in (1, 2):
        pdf.add_page()
        pdf.multi_cell(0, 16, f"Contenido de la pagina {n} del documento de prueba.")
    return bytes(pdf.output())


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_devuelve_la_pagina_como_png(client: TestClient, pdf_dos_paginas: bytes) -> None:
    r = client.post(
        "/pdf-page",
        files={"file": ("doc.pdf", pdf_dos_paginas, "application/pdf")},
        data={"page": "2"},
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content[:4] == b"\x89PNG"
    assert "max-age" in r.headers.get("cache-control", "")


def test_una_pagina_que_no_existe_es_404(client: TestClient, pdf_dos_paginas: bytes) -> None:
    """404 y no un 500: pedir una página de más es una entrada equivocada, no un fallo."""
    r = client.post(
        "/pdf-page",
        files={"file": ("doc.pdf", pdf_dos_paginas, "application/pdf")},
        data={"page": "99"},
    )
    assert r.status_code == 404


def test_una_pagina_cero_o_negativa_es_400(client: TestClient, pdf_dos_paginas: bytes) -> None:
    for pagina in ("0", "-1"):
        r = client.post(
            "/pdf-page",
            files={"file": ("doc.pdf", pdf_dos_paginas, "application/pdf")},
            data={"page": pagina},
        )
        assert r.status_code == 400


def test_sin_pdf_no_dibuja_nada(client: TestClient) -> None:
    """Solo PDF: una imagen o un audio no tienen páginas que dibujar."""
    r = client.post(
        "/pdf-page",
        files={"file": ("foto.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")},
        data={"page": "1"},
    )
    assert r.status_code == 400


def test_sin_archivo_es_400(client: TestClient) -> None:
    assert client.post("/pdf-page", data={"page": "1"}).status_code == 400
