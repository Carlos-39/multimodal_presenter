"""Construcción del modelo (PydanticAI) desde la config tipada.

Primario: Anthropic (claude-sonnet-5).
Fallback: Gemini vía OpenRouter (gateway OpenAI-compatible).
Ambos envueltos en un `FallbackModel`: si el primario falla (error de API, rate limit,
indisponibilidad), PydanticAI reintenta automáticamente con el fallback.

Las claves se validan AQUÍ (en runtime), no al importar la app, para que el CI —que mockea
el LLM inyectando un modelo de prueba— no necesite claves reales.
"""

import truststore
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.openrouter import OpenRouterProvider

from .config import Settings

# TLS saliente usando el almacén de certificados del SISTEMA (no el bundle de certifi).
# En Windows con inspección TLS (antivirus/proxy que inyecta su CA raíz), certifi no la
# tiene y las llamadas a las APIs fallan con CERTIFICATE_VERIFY_FAILED; el almacén del
# sistema sí la incluye. Debe inyectarse antes de crear los clientes HTTP de los modelos.
truststore.inject_into_ssl()


def build_model(settings: Settings) -> Model:
    """Devuelve el modelo a usar. Lanza si falta la clave del primario (Anthropic).

    Si hay clave de OpenRouter, devuelve un FallbackModel [Anthropic → Gemini/OpenRouter];
    si no, solo el primario (Anthropic).
    """
    if not settings.anthropic_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY es obligatoria para ejecutar el pipeline. "
            "Definila en backend/.env (ver .env.example). "
            "En tests se inyecta un modelo mock, así que no se necesita clave real."
        )

    primary = AnthropicModel(
        settings.anthropic_model,
        provider=AnthropicProvider(api_key=settings.anthropic_api_key),
    )

    if not settings.openrouter_api_key:
        return primary  # sin OpenRouter: solo el primario, sin fallback.

    fallback = OpenAIChatModel(
        settings.openrouter_gemini_model,
        provider=OpenRouterProvider(api_key=settings.openrouter_api_key),
    )
    return FallbackModel(primary, fallback)


def build_summary_model(settings: Settings) -> Model:
    """Modelo liviano (Haiku) para el adelanto inicial (Hito 5g). Mismo proveedor Anthropic.

    Sin fallback: el adelanto es un extra no crítico; si falla, el frontend lo muestra como tal
    (honestidad) y la transformación completa (Sonnet) sigue su curso aparte.
    """
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY es obligatoria para el adelanto inicial.")
    return AnthropicModel(
        settings.anthropic_summary_model,
        provider=AnthropicProvider(api_key=settings.anthropic_api_key),
    )
