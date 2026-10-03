"""Integración del localizador de regiones (F2): que la región LLEGUE al contrato.

El módulo en sí ya está probado aparte (`test_pdf_locator.py`). Lo que se fija aquí es el
cableado, que es donde se rompen estas cosas: que los tres caminos que abren el panel de fuente
—una sección del contenido, una respuesta del chat y una diapositiva generada— lleven la región,
y que las demás fuentes sigan intactas.

Y lo más importante de todo: que el LLM NUNCA reciba nada de esto. No basta con que sea la
intención; aquí se comprueba contra lo que realmente se le manda al modelo.
"""

from __future__ import annotations

import asyncio
import json
import pathlib

import matplotlib
import pytest
from fpdf import FPDF
from pydantic_ai.models.test import TestModel

from multimodal_presenter.pipeline import transform
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.streaming import transform_stream
from multimodal_presenter.pipeline.structuring import build_model_input
from multimodal_presenter.pipeline.validation import ground_quote

_TTF = pathlib.Path(matplotlib.get_data_path()) / "fonts" / "ttf" / "DejaVuSans.ttf"

CITA = "La mesosfera se extiende entre los cincuenta y los noventa kilometros"
PARRAFO = (
    "Los duendes rojos son descargas electricas que ocurren sobre las tormentas intensas. "
    + CITA
    + " de altura sobre la superficie terrestre, muy por encima de donde vuelan los aviones."
)


@pytest.fixture(scope="module")
def pdf_con_texto() -> bytes:
    pdf = FPDF(unit="pt", format="A4")
    pdf.add_font("dejavu", "", str(_TTF))
    pdf.set_font("dejavu", size=11)
    pdf.add_page()
    pdf.multi_cell(0, 16, PARRAFO)
    return bytes(pdf.output())


def _presentacion(cita: str, page: int | None) -> dict:
    fuente = {"document_id": "d", "quote": cita}
    if page is not None:
        fuente["page"] = page
    return {
        "title": "t",
        "sections": [
            {
                "id": "s1",
                "role": "core",
                "source": fuente,
                "content": {"content_type": "text", "text": "x"},
            }
        ],
    }


# ─────────────────────────────────────────────────────────────
# Los tres caminos que abren el panel de fuente
# ─────────────────────────────────────────────────────────────
def test_una_seccion_de_pdf_lleva_su_region(pdf_con_texto: bytes) -> None:
    modelo = TestModel(custom_output_text=json.dumps(_presentacion(CITA, 1)))
    resultado = asyncio.run(
        transform(
            modelo,
            binary=pdf_con_texto,
            media_type="application/pdf",
            semantic_enabled=False,
        )
    )
    (entrada,) = resultado.grounding.sections
    assert entrada.status == "unverified"  # localizar NO verifica: el estado no cambia
    assert entrada.page == 1
    assert entrada.region is not None
    assert entrada.region.quality == "exact"
    assert entrada.region.boxes
    for caja in entrada.region.boxes:
        assert 0.0 <= caja.x0 < caja.x1 <= 1.0
        assert 0.0 <= caja.y0 < caja.y1 <= 1.0


def test_el_streaming_tambien_la_lleva(pdf_con_texto: bytes) -> None:
    """El camino que usa la app de verdad es el streaming, no el de una sola respuesta."""
    modelo = TestModel(custom_output_text=json.dumps(_presentacion(CITA, 1)))

    async def run() -> list:
        return [
            e
            async for e in transform_stream(
                modelo,
                binary=pdf_con_texto,
                media_type="application/pdf",
                semantic_enabled=False,
            )
            if e.type == "section"
        ]

    (evento,) = asyncio.run(run())
    assert evento.grounding.region is not None
    assert evento.grounding.region.quality == "exact"


def test_una_cita_suelta_del_chat_o_del_deck_lleva_su_region(pdf_con_texto: bytes) -> None:
    from multimodal_presenter.pipeline.pdf_locator import abrir_localizador

    extraction = prepare_input(binary=pdf_con_texto, media_type="application/pdf")
    with abrir_localizador(extraction.source_kind, extraction.binary) as localizador:
        ancla = ground_quote(CITA, 1, extraction, localizador)
    assert ancla.status == "unverified"
    assert ancla.region is not None and ancla.region.quality == "exact"


# ─────────────────────────────────────────────────────────────
# Degradación: nada de lo que ya funcionaba cambia
# ─────────────────────────────────────────────────────────────
def test_una_cita_que_no_esta_en_la_pagina_deja_la_region_vacia(pdf_con_texto: bytes) -> None:
    """Sin región = fidelidad de página, el comportamiento de siempre. No es un error."""
    inventada = "El precio del cafe colombiano subio un quince por ciento este trimestre"
    modelo = TestModel(custom_output_text=json.dumps(_presentacion(inventada, 1)))
    resultado = asyncio.run(
        transform(
            modelo,
            binary=pdf_con_texto,
            media_type="application/pdf",
            semantic_enabled=False,
        )
    )
    (entrada,) = resultado.grounding.sections
    assert entrada.status == "unverified"  # igual que antes
    assert entrada.page == 1  # la página se conserva
    assert entrada.region is None


def test_una_fuente_de_texto_no_tiene_region() -> None:
    """El texto plano ya tiene fidelidad EXACTA por offsets: la región no le aporta nada."""
    texto = PARRAFO
    modelo = TestModel(custom_output_text=json.dumps(_presentacion(CITA, None)))
    resultado = asyncio.run(transform(modelo, text=texto, semantic_enabled=False))
    (entrada,) = resultado.grounding.sections
    assert entrada.status == "verified"
    assert entrada.region is None


def test_un_pdf_sin_pagina_en_la_cita_no_revienta(pdf_con_texto: bytes) -> None:
    """El modelo puede no decir la página. Sin página no hay dónde buscar: se degrada."""
    modelo = TestModel(custom_output_text=json.dumps(_presentacion(CITA, None)))
    resultado = asyncio.run(
        transform(
            modelo,
            binary=pdf_con_texto,
            media_type="application/pdf",
            semantic_enabled=False,
        )
    )
    (entrada,) = resultado.grounding.sections
    assert entrada.region is None


# ─────────────────────────────────────────────────────────────
# La garantía estructural: el LLM no ve nada de esto
# ─────────────────────────────────────────────────────────────
def test_lo_que_se_le_manda_al_modelo_no_contiene_texto_ni_coordenadas(
    pdf_con_texto: bytes,
) -> None:
    """La promesa de "nunca aplanar" se comprueba, no se declara.

    Se inspecciona lo que REALMENTE se le pasa al agente de estructuración: tiene que ser el PDF
    binario nativo y nada más. Si alguien cableara el localizador antes de la generación —para
    "ayudar" al modelo con el texto extraído— este test lo caza: aparecería el párrafo como
    string entre las partes del prompt.
    """
    extraction = prepare_input(binary=pdf_con_texto, media_type="application/pdf")
    partes = build_model_input(extraction)

    binarios = [p for p in partes if not isinstance(p, str)]
    textos = " ".join(p for p in partes if isinstance(p, str))

    assert binarios, "el modelo debe seguir recibiendo el PDF nativo"
    assert any(getattr(b, "media_type", None) == "application/pdf" for b in binarios)
    # Ni el contenido del documento ni ninguna geometría viajan como texto al prompt.
    assert CITA not in textos
    assert "region" not in textos.lower()
    assert "x0" not in textos and "boxes" not in textos


def test_el_modelo_del_chat_no_tiene_donde_poner_una_region() -> None:
    """Garantía por construcción: el esquema que rellena el LLM ni siquiera admite el campo.

    `ChatAnswer` es lo que produce el modelo; `ChatResponse` es lo que sale al frontend tras la
    Fase 3. La región solo existe en la segunda, así que no hay forma de que el modelo la vea ni
    de que la invente.
    """
    from multimodal_presenter.schemas.chat import ChatAnswer, ChatResponse

    assert "region" not in ChatAnswer.model_fields
    assert "region" in ChatResponse.model_fields


def test_ningun_modulo_de_prompts_importa_el_localizador() -> None:
    """Que la separación siga siendo cierta mañana, no solo hoy.

    Los módulos que construyen entradas para un modelo no deben tocar el localizador. Si alguien
    lo importa en uno de ellos, este test falla y obliga a justificarlo.
    """
    raiz = pathlib.Path(__file__).resolve().parents[1] / "src" / "multimodal_presenter" / "pipeline"
    de_prompts = ("structuring.py", "perception.py", "narration.py", "illustration.py")
    for nombre in de_prompts:
        ruta = raiz / nombre
        if not ruta.exists():
            continue
        fuente = ruta.read_text(encoding="utf-8")
        assert "pdf_locator" not in fuente, f"{nombre} no debería conocer el localizador"
