"""Construcción del modelo (PydanticAI) desde la config tipada.

Dos roles, los dos cubiertos por una sola clave de Google (AI Studio):

- Estructuración (Fase 2): primario Anthropic (`claude-sonnet-5`), fallback Gemini
  directo. Envueltos en un `FallbackModel`: si el primario falla al arrancar (error de API,
  rate limit, indisponibilidad), PydanticAI reintenta con el fallback. Antes se llegaba al
  mismo Gemini a través de OpenRouter; ahora va directo, un intermediario menos, una clave
  menos, y el mismo modelo.
- Percepción de audio (Fase 0): Gemini con entrada acústica nativa, APARTE del
  `FallbackModel` y sin fallback propio (ver `build_perception_model`).

Las claves se validan AQUÍ (en runtime), no al importar la app, para que el CI (que mockea
el LLM inyectando un modelo de prueba) no necesite claves reales.
"""

import truststore
from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.settings import ModelSettings

from .config import Settings

# TLS saliente usando el almacén de certificados del SISTEMA (no el bundle de certifi).
# En Windows con inspección TLS (antivirus/proxy que inyecta su CA raíz), certifi no la
# tiene y las llamadas a las APIs fallan con CERTIFICATE_VERIFY_FAILED; el almacén del
# sistema sí la incluye. Debe inyectarse antes de crear los clientes HTTP de los modelos.
truststore.inject_into_ssl()


#: Techo de tokens de SALIDA por llamada.
#:
#: Hay que ponerlo a mano porque el defecto de pydantic-ai son 4096, y ese número mordió en
#: producción: estructurar un PDF de dos páginas gasta unos 3400, y el modelo PIENSA antes de
#: escribir (medido: 655 tokens de pensamiento), que sale del mismo presupuesto. O sea un margen
#: del orden del 12%, y por tanto una moneda al aire en cada transformación: el mismo documento
#: pasaba dos veces y a la tercera el JSON llegaba cortado a mitad de una cadena.
#:
#: Y cortado no hay vuelta atrás: `run_stream()` no admite reintentos de validación, así que el
#: stream muere con la presentación a medias.
#:
#: Subirlo no cuesta dinero. Se paga por token GENERADO, no por el techo, así que esto no
#: encarece ninguna llamada que ya funcionaba: solo deja de truncar las que se pasaban. Lo que
#: acota el gasto es el prompt, que limita cuántas secciones pedir.
_MAX_TOKENS_SALIDA = 16384

#: Lo mismo para el adelanto inicial, que es un párrafo. No necesita margen, pero sí necesita
#: ser EXPLÍCITO: el defecto invisible de la librería es justo lo que costó el fallo de arriba.
_MAX_TOKENS_ADELANTO = 2048


def build_model(settings: Settings) -> Model:
    """Devuelve el modelo de estructuración. Lanza si falta la clave del primario (Anthropic).

    Con `GOOGLE_API_KEY` devuelve un `FallbackModel [Anthropic → Gemini]`; sin ella, solo el
    primario (Anthropic), que es suficiente para operar.
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
        settings=ModelSettings(max_tokens=_MAX_TOKENS_SALIDA),
    )

    if not settings.google_api_key:
        return primary  # sin clave de Google: solo el primario, sin fallback.

    fallback = GoogleModel(
        settings.google_model,
        provider=GoogleProvider(api_key=settings.google_api_key),
        settings=ModelSettings(max_tokens=_MAX_TOKENS_SALIDA),
    )
    return FallbackModel(primary, fallback)


def build_perception_model(settings: Settings) -> Model:
    """Modelo de la Fase 0 (percepción de audio): Gemini, con entrada acústica nativa.

    Es un paso NUEVO y ANTERIOR al pipeline, no un reemplazo de nada: no entra en el
    `FallbackModel` de la estructuración, que sigue siendo el único que decide la Fase 2. Se
    construye aparte para que un problema de acceso a Gemini en la percepción no
    pueda afectar al motor principal.

    Sin fallback, deliberadamente. Es el mismo criterio por el que se descartó estructurar
    el audio con Gemini: si la anotación cayera en silencio a otra familia de modelos, su
    calidad cambiaría sin que nadie lo note. Un error claro es más honesto que una degradación
    invisible. (Las alternativas con entrada de audio, además, aceptan menos
    formatos: la familia `gpt-4o-audio-preview` de OpenAI solo admite WAV y MP3.)

    Sin clave lanza: el endpoint lo traduce a un 503 con mensaje claro (mismo patrón que la
    narración y la transcripción). Nunca falla en silencio.
    """
    if not settings.google_api_key:
        raise RuntimeError(
            "La entrada de audio necesita un modelo con entrada acústica nativa. "
            "Define GOOGLE_API_KEY (Google AI Studio) en backend/.env (ver .env.example). "
            "El resto del pipeline (texto, PDF, imagen) no la necesita."
        )
    return GoogleModel(
        settings.google_perception_model,
        provider=GoogleProvider(api_key=settings.google_api_key),
        settings=ModelSettings(max_tokens=_MAX_TOKENS_SALIDA),
    )


def build_summary_model(settings: Settings) -> Model:
    """Modelo liviano (Haiku) para el adelanto inicial. Mismo proveedor Anthropic.

    Sin fallback: el adelanto es un extra no crítico; si falla, el frontend lo muestra como tal
    (honestidad) y la transformación completa (Sonnet) sigue su curso aparte.
    """
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY es obligatoria para el adelanto inicial.")
    return AnthropicModel(
        settings.anthropic_summary_model,
        provider=AnthropicProvider(api_key=settings.anthropic_api_key),
        settings=ModelSettings(max_tokens=_MAX_TOKENS_ADELANTO),
    )
