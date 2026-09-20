"""Construcción del modelo Gemini (PydanticAI) desde la config tipada.

La clave `GEMINI_API_KEY` es obligatoria para ejecutar el pipeline, pero se valida
AQUÍ (en runtime, al construir el modelo), no al importar la app. Así el CI —que mockea
el LLM inyectando un modelo de prueba— no necesita una clave real, y un despliegue sin
clave falla con un mensaje claro en vez de un error opaco.
"""

from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider

from .config import Settings


def build_google_model(settings: Settings) -> GoogleModel:
    """Devuelve el modelo Gemini configurado. Lanza si falta la clave."""
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY es obligatoria para ejecutar el pipeline. "
            "Definila en backend/.env (ver .env.example). "
            "En tests se inyecta un modelo mock, así que no se necesita clave real."
        )
    provider = GoogleProvider(api_key=settings.gemini_api_key)
    return GoogleModel(settings.gemini_model, provider=provider)
