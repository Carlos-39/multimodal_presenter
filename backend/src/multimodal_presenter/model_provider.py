"""Construcción del modelo (PydanticAI) desde la config tipada.

Primario: Anthropic (claude-sonnet-5).
Fallback: Gemini vía OpenRouter (gateway OpenAI-compatible).
Aparte (no en el `FallbackModel`): el modelo de PERCEPCIÓN de audio (Fase 0), que necesita
entrada acústica nativa — ver `build_perception_model`.
Ambos envueltos en un `FallbackModel`: si el primario falla (error de API, rate limit,
indisponibilidad), PydanticAI reintenta automáticamente con el fallback.

Las claves se validan AQUÍ (en runtime), no al importar la app, para que el CI —que mockea
el LLM inyectando un modelo de prueba— no necesite claves reales.
"""

from typing import Literal

import truststore
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.google import GoogleProvider
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


PerceptionRoute = Literal["google", "openrouter"]

# Formatos de audio que la ruta de CONTINGENCIA (OpenRouter) no puede transportar: PydanticAI
# no los tiene en su mapa de formatos y `BinaryContent.format` lanza `Unknown media type`. La
# ruta primaria (Google) sí los admite, porque `GoogleModel` pasa el media_type tal cual a
# `inline_data` sin consultar ese mapa. Verificado contra PydanticAI 2.46.
OPENROUTER_UNSUPPORTED_AUDIO: frozenset[str] = frozenset({"audio/m4a"})


def perception_route(settings: Settings) -> PerceptionRoute | None:
    """Qué ruta de percepción está activa, sin construir el modelo. None si no hay ninguna.

    Permite avisar ANTES de llamar al proveedor cuando el formato no viaja por la ruta activa
    (ver `OPENROUTER_UNSUPPORTED_AUDIO`), en vez de dejar que falle adentro.
    """
    if settings.google_api_key:
        return "google"
    if settings.openrouter_api_key:
        return "openrouter"
    return None


def build_perception_model(settings: Settings) -> Model:
    """Modelo de la Fase 0 (percepción de audio): Gemini, con entrada acústica nativa.

    Es un paso NUEVO y ANTERIOR al pipeline, no un reemplazo de nada: el `FallbackModel` de
    la estructuración (Anthropic → Gemini/OpenRouter) queda intacto y sigue siendo el único
    que decide la Fase 2. Se construye aparte a propósito, para que un problema de acceso a
    Gemini no pueda afectar al motor principal.

    Dos rutas, en orden de preferencia:
    1. **Google AI Studio directo** (`GoogleModel`) si hay `GOOGLE_API_KEY`.
    2. **OpenRouter** (gateway OpenAI-compatible) si hay `OPENROUTER_API_KEY`, apuntando al
       mismo Gemini. Es contingencia por el historial de bloqueos de acceso con Google.

    Sin ninguna de las dos claves lanza: el endpoint lo traduce a un 503 con mensaje claro
    (mismo patrón que la narración y la transcripción). Nunca falla en silencio.
    """
    route = perception_route(settings)
    if route == "google":
        assert settings.google_api_key is not None
        return GoogleModel(
            settings.google_perception_model,
            provider=GoogleProvider(api_key=settings.google_api_key),
        )
    if route == "openrouter":
        assert settings.openrouter_api_key is not None
        return OpenAIChatModel(
            settings.openrouter_perception_model,
            provider=OpenRouterProvider(api_key=settings.openrouter_api_key),
        )
    raise RuntimeError(
        "La entrada de audio necesita un modelo con entrada acústica nativa. "
        "Define GOOGLE_API_KEY (Google AI Studio) o, como alternativa, "
        "OPENROUTER_API_KEY en backend/.env (ver .env.example). "
        "El resto del pipeline (texto, PDF, imagen) no la necesita."
    )


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
