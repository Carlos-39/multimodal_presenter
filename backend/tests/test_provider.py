"""Parte B3 (Hito 5f) — El sistema arranca con SOLO Anthropic; el fallback es opt-in por clave.

Sin red: `build_model` solo CONSTRUYE los objetos del modelo (no llama a la API). Demuestra:
- con solo `ANTHROPIC_API_KEY` → un `AnthropicModel` (primario, sin fallback),
- añadir `OPENROUTER_API_KEY` → un `FallbackModel [Anthropic → OpenRouter]`,
- sin `ANTHROPIC_API_KEY` → error claro (no arranca en silencio).

Honestidad: esto verifica el CABLEADO (qué modelo se arma según las claves). El fallback NO se
ejercita de punta a punta aquí (haría falta forzar un fallo del primario y una clave real de
OpenRouter); cualquier afirmación sobre su comportamiento en vivo es a nivel de diseño.
"""

from __future__ import annotations

import pytest
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.fallback import FallbackModel

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_model


def _settings(*, anthropic: str | None, openrouter: str | None):
    return get_settings().model_copy(
        update={"anthropic_api_key": anthropic, "openrouter_api_key": openrouter}
    )


def test_only_anthropic_boots_primary_without_fallback() -> None:
    model = build_model(_settings(anthropic="sk-ant-test", openrouter=None))
    assert isinstance(model, AnthropicModel)
    assert not isinstance(model, FallbackModel)


def test_fallback_is_built_only_when_openrouter_key_present() -> None:
    model = build_model(_settings(anthropic="sk-ant-test", openrouter="sk-or-test"))
    assert isinstance(model, FallbackModel)


def test_missing_anthropic_key_raises() -> None:
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        build_model(_settings(anthropic=None, openrouter=None))
