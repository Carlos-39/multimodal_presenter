"""Configuración de la aplicación.

Los secretos (claves de API, tokens) se leen SIEMPRE del entorno / archivo `.env`,
nunca se escriben en el código. `.env` está gitignoreado; `.env.example` documenta
las variables con placeholders.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Ajustes tipados, poblados desde variables de entorno o `.env`.

    pydantic-settings hace el match de nombres sin distinguir mayúsculas, así que
    `ANTHROPIC_API_KEY` en el entorno mapea a `anthropic_api_key` aquí.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Identidad / entorno
    app_name: str = "Multimodal Presenter API"
    environment: str = "development"

    # Modelo (PydanticAI). Primario: Anthropic Claude. Fallback: Gemini vía OpenRouter.
    # Las claves se validan en runtime al construir el modelo (model_provider.build_model),
    # no al importar la app, para que el CI (que mockea el LLM) no requiera claves reales.
    # Nunca se hardcodean.
    #
    # Primario — Anthropic (OBLIGATORIO para ejecutar el pipeline):
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    #
    # Fallback — Gemini vía OpenRouter (recomendado; si falta, solo se usa el primario).
    # El id es el de OpenRouter (gateway OpenAI-compatible), configurable sin tocar código.
    openrouter_api_key: str | None = None
    openrouter_gemini_model: str = "google/gemini-3-pro-preview"

    # Entrada multimodal (Hito 4): tope de tamaño de archivo subido, en MB.
    max_upload_mb: int = 20

    # Observabilidad (Logfire)
    logfire_token: str | None = None
    logfire_service_name: str = "multimodal-presenter-backend"


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de `Settings` (se lee `.env` una sola vez)."""
    return Settings()
