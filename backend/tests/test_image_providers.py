"""Cadena de proveedores de imagen: quién va primero y qué pasa cuando falla.

Gemini pasó a primario tras medirlo contra Ideogram con los mismos prompts reales (0 de 6
imágenes con palabras inventadas frente a 3 de 6, y más barato). Los otros dos siguen cableados
como respaldo por una razón concreta: Gemini filtra por seguridad con más agresividad y puede
rechazar un prompt que los otros aceptan — y una imagen peor es mejor que ninguna imagen.

Estos tests fijan el ORDEN y la degradación. No llaman a ningún proveedor real.
"""

from __future__ import annotations

import asyncio

import pytest

from multimodal_presenter.config import Settings
from multimodal_presenter.pipeline import illustration
from multimodal_presenter.pipeline.illustration import (
    _IMAGE_STYLE_PREFIX,
    _generate_image,
    has_image_provider,
)

TODAS = {"google_api_key": "g", "ideogram_api_key": "i", "openai_api_key": "o"}


def _ajustes(**claves: str | None) -> Settings:
    """Ajustes con SOLO las claves que se pasen; las demás, ausentes.

    Se construye desde cero a propósito: así cada test dice en su llamada qué proveedores existen
    en ese escenario, en vez de depender de lo que tenga el `.env` real de la máquina.
    """
    base = dict.fromkeys(TODAS)
    base.update(claves)
    return Settings(logfire_token="", **base)


def _dobles(monkeypatch: pytest.MonkeyPatch, llamados: list[str], fallan: set[str]) -> None:
    for nombre in ("_gemini_image", "_ideogram_image", "_openai_image"):
        proveedor = nombre.strip("_").split("_")[0]

        async def doble(_s, _p, _proveedor=proveedor):
            llamados.append(_proveedor)
            if _proveedor in fallan:
                raise RuntimeError(f"{_proveedor} caído")
            return f"data:image/png;base64,{_proveedor}"

        monkeypatch.setattr(illustration, nombre, doble)


# ─────────────────────────────────────────────────────────────
# El orden
# ─────────────────────────────────────────────────────────────
def test_gemini_va_primero(monkeypatch: pytest.MonkeyPatch) -> None:
    llamados: list[str] = []
    _dobles(monkeypatch, llamados, fallan=set())
    uri = asyncio.run(_generate_image(_ajustes(**TODAS), "un volcán"))
    assert llamados == ["gemini"], "no se debe molestar a los respaldos si el primario responde"
    assert uri.endswith("gemini")


def test_si_gemini_falla_toma_el_relevo_ideogram(monkeypatch: pytest.MonkeyPatch) -> None:
    """El caso real: Gemini rechaza el prompt por filtro de seguridad."""
    llamados: list[str] = []
    _dobles(monkeypatch, llamados, fallan={"gemini"})
    uri = asyncio.run(_generate_image(_ajustes(**TODAS), "un volcán"))
    assert llamados == ["gemini", "ideogram"]
    assert uri.endswith("ideogram")


def test_si_fallan_los_dos_primeros_queda_openai(monkeypatch: pytest.MonkeyPatch) -> None:
    llamados: list[str] = []
    _dobles(monkeypatch, llamados, fallan={"gemini", "ideogram"})
    uri = asyncio.run(_generate_image(_ajustes(**TODAS), "un volcán"))
    assert llamados == ["gemini", "ideogram", "openai"]
    assert uri.endswith("openai")


def test_sin_la_clave_de_uno_se_salta_sin_intentarlo(monkeypatch: pytest.MonkeyPatch) -> None:
    llamados: list[str] = []
    _dobles(monkeypatch, llamados, fallan=set())
    sin_gemini = _ajustes(ideogram_api_key="i", openai_api_key="o")
    asyncio.run(_generate_image(sin_gemini, "un volcán"))
    assert llamados == ["ideogram"], "sin clave no se llama al proveedor"


# ─────────────────────────────────────────────────────────────
# Degradación honesta: sin ninguno, el sistema sigue funcionando sin imágenes
# ─────────────────────────────────────────────────────────────
def test_sin_ninguna_clave_no_hay_proveedor() -> None:
    assert has_image_provider(_ajustes()) is False
    for clave in TODAS:
        assert has_image_provider(_ajustes(**{clave: "x"})) is True, clave


def test_sin_ninguna_clave_lanza_en_vez_de_devolver_algo_falso() -> None:
    """Quien llama ya sabe degradar; lo que no puede es recibir una imagen inventada."""
    with pytest.raises(RuntimeError, match="No hay proveedor de imagen"):
        asyncio.run(_generate_image(_ajustes(), "un volcán"))


# ─────────────────────────────────────────────────────────────
# La regla endurecida viaja DELANTE del asunto
# ─────────────────────────────────────────────────────────────
def test_la_restriccion_va_antes_del_asunto(monkeypatch: pytest.MonkeyPatch) -> None:
    """Enterrarla al final de una descripción larga la debilita: se midió.

    También se comprueba que prohíbe las referencias huérfanas (numeración, leyendas, líneas
    guía), no solo el texto: una marca que remite a una clave inexistente deja peor a quien no
    conoce el tema que no poner nada.
    """
    vistos: list[str] = []

    async def espia(_s, prompt):
        vistos.append(prompt)
        return "data:image/png;base64,x"

    monkeypatch.setattr(illustration, "_gemini_image", espia)
    asyncio.run(_generate_image(_ajustes(**TODAS), "EL ASUNTO A DIBUJAR"))

    (prompt,) = vistos
    assert prompt.startswith(_IMAGE_STYLE_PREFIX)
    assert prompt.endswith("EL ASUNTO A DIBUJAR")
    assert prompt.index("no callout numbers") < prompt.index("EL ASUNTO A DIBUJAR")
    for prohibido in ("no legend", "no leader lines", "never number them"):
        assert prohibido in prompt
