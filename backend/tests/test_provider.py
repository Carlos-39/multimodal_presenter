"""Parte B3 (Hito 5f): El sistema arranca con SOLO Anthropic; el fallback es opt-in por clave.

Sin red: `build_model` solo CONSTRUYE los objetos del modelo (no llama a la API). Demuestra:
- con solo `ANTHROPIC_API_KEY` → un `AnthropicModel` (primario, sin fallback),
- añadir `GOOGLE_API_KEY` → un `FallbackModel [Anthropic → Gemini directo]`,
- sin `ANTHROPIC_API_KEY` → error claro (no arranca en silencio).

El fallback pasó de *Gemini vía OpenRouter* a **Gemini directo**: mismo modelo, un
intermediario menos y una clave menos. La misma `GOOGLE_API_KEY` sirve a la percepción de
audio (Fase 0), así que ambos roles comparten credencial, pero NO modelo ni código: la
percepción se construye aparte y sin fallback (ver `build_perception_model`).

Honestidad: esto verifica el CABLEADO (qué modelo se arma según las claves). El fallback NO se
ejercita de punta a punta aquí (haría falta forzar un fallo del primario); cualquier afirmación
sobre su comportamiento en vivo es a nivel de diseño.
"""

from __future__ import annotations

import pytest
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.google import GoogleModel

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import (
    build_model,
    build_perception_model,
    build_summary_model,
)


def _settings(*, anthropic: str | None, google: str | None):
    return get_settings().model_copy(
        update={"anthropic_api_key": anthropic, "google_api_key": google}
    )


def test_only_anthropic_boots_primary_without_fallback() -> None:
    model = build_model(_settings(anthropic="sk-ant-test", google=None))
    assert isinstance(model, AnthropicModel)
    assert not isinstance(model, FallbackModel)


def test_fallback_is_built_only_when_google_key_present() -> None:
    model = build_model(_settings(anthropic="sk-ant-test", google="goog-test"))
    assert isinstance(model, FallbackModel)


def test_missing_anthropic_key_raises() -> None:
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        build_model(_settings(anthropic=None, google=None))


# ─────────────────────────────────────────────────────────────
# Percepción de audio (Fase 0): misma clave, modelo aparte, SIN fallback
# ─────────────────────────────────────────────────────────────
def test_perception_model_is_google_and_standalone() -> None:
    """No es un FallbackModel: un fallback silencioso cambiaría la calidad de la anotación,
    que es justo el instrumento que mide la mini-evaluación (mismo criterio que descartó
    estructurar el audio con Gemini)."""
    model = build_perception_model(_settings(anthropic="sk-ant-test", google="goog-test"))
    assert isinstance(model, GoogleModel)
    assert not isinstance(model, FallbackModel)


def test_perception_without_google_key_raises_naming_the_variable() -> None:
    with pytest.raises(RuntimeError, match="GOOGLE_API_KEY"):
        build_perception_model(_settings(anthropic="sk-ant-test", google=None))


def test_perception_does_not_depend_on_anthropic() -> None:
    """Son roles independientes: la percepción no necesita la clave del motor principal."""
    model = build_perception_model(_settings(anthropic=None, google="goog-test"))
    assert isinstance(model, GoogleModel)


def test_todos_los_modelos_declaran_su_techo_de_salida() -> None:
    """Ninguno puede quedarse con el defecto invisible de pydantic-ai, que son 4096 tokens.

    Ese número mordió en producción. Estructurar un PDF de dos páginas gasta unos 3400 tokens
    de salida, y el modelo PIENSA antes de escribir (medido: 655 tokens), que sale del mismo
    presupuesto: queda un margen del orden del 12%, o sea una moneda al aire en cada
    transformación. Cuando salió cruz, el JSON llegó cortado a mitad de una cadena, y
    `run_stream()` no admite reintentos de validación: el stream murió con la presentación a
    medias y sin forma de recuperarla.

    Mira la configuración y no el comportamiento, a propósito: un modelo nuevo añadido sin
    `settings` hereda ese 4096 sin que nada se queje, y eso es lo que no puede repetirse.
    """
    ajustes = _settings(anthropic="sk-ant-test", google="goog-test")
    modelos = {
        "estructuración": build_model(ajustes),
        "adelanto": build_summary_model(ajustes),
        "percepción": build_perception_model(ajustes),
    }
    for nombre, modelo in modelos.items():
        # El fallback no tiene techo propio: lo tienen los dos modelos que envuelve.
        for uno in getattr(modelo, "models", None) or [modelo]:
            techo = (uno.settings or {}).get("max_tokens")
            assert techo, f"{nombre} ({uno.model_name}) se queda con el defecto de 4096"
            if nombre != "adelanto":  # el adelanto es un párrafo: no necesita margen
                assert techo > 4096, f"{nombre} ({uno.model_name}) no tiene margen sobre 4096"
