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
    app_name: str = "Smart Presenter API"
    environment: str = "development"

    # Secretos (opcionales en Hito 0: el backend arranca sin ellos).
    # TODO(Hito2): GEMINI_API_KEY pasa a ser obligatoria cuando se conecte el modelo.
    gemini_api_key: str | None = None

    # Observabilidad (Logfire)
    logfire_token: str | None = None
    logfire_service_name: str = "smart-presenter-backend"


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de `Settings` (se lee `.env` una sola vez)."""
    return Settings()
