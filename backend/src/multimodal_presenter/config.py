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
    `GEMINI_API_KEY` en el entorno mapea a `gemini_api_key` aquí.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Identidad / entorno
    app_name: str = "Multimodal Presenter API"
    environment: str = "development"

    # Modelo (Gemini vía PydanticAI).
    # gemini_api_key es OBLIGATORIA para ejecutar el pipeline: se valida en runtime al
    # construir el modelo (model_provider.build_google_model), no al importar la app, para
    # que el CI (que mockea el LLM) no requiera clave real. Nunca se hardcodea.
    gemini_api_key: str | None = None
    # Gemini 3.1 Pro (PROYECTO.md §4, no una variante flash). El id real de la API lleva
    # sufijo -preview. OJO: requiere billing habilitado (cuota 0 en el tier gratuito).
    gemini_model: str = "gemini-3.1-pro-preview"

    # Entrada multimodal (Hito 4): tope de tamaño de archivo subido, en MB.
    max_upload_mb: int = 20

    # Observabilidad (Logfire)
    logfire_token: str | None = None
    logfire_service_name: str = "multimodal-presenter-backend"


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de `Settings` (se lee `.env` una sola vez)."""
    return Settings()
