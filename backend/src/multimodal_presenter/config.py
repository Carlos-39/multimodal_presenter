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

    # Modelo (PydanticAI). Primario: Anthropic. Fallback: Gemini vía OpenRouter.
    # Las claves se validan en runtime al construir el modelo (model_provider.build_model),
    # no al importar la app, para que el CI (que mockea el LLM) no requiera claves reales.
    # Nunca se hardcodean.
    #
    # Primario — Anthropic (OBLIGATORIO para ejecutar el pipeline):
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    # Modelo liviano para el adelanto/resumen inicial (Hito 5g): rápido y barato, corre en
    # paralelo a la estructuración (Sonnet) para dar un preview mientras el pipeline trabaja.
    anthropic_summary_model: str = "claude-haiku-4-5-20251001"
    #
    # Fallback — Gemini vía OpenRouter (recomendado; si falta, solo se usa el primario).
    # El id es el de OpenRouter (gateway OpenAI-compatible), configurable sin tocar código.
    openrouter_api_key: str | None = None
    openrouter_gemini_model: str = "google/gemini-3-pro-preview"

    # Verificación semántica de gráficos (Fase 3, 2ª llamada al LLM). Ponla en false durante
    # el desarrollo para NO gastar esa llamada extra en documentos con gráficos.
    semantic_verification_enabled: bool = True

    # Entrada multimodal (Hito 4): tope de tamaño de archivo subido, en MB.
    max_upload_mb: int = 20

    # Observabilidad (Logfire)
    logfire_token: str | None = None
    logfire_service_name: str = "multimodal-presenter-backend"

    # Telemetría de comportamiento (Hito 8). Se anexa a JSONL para análisis posterior.
    # `telemetry_dir` vacío → carpeta por defecto fuera de OneDrive (LOCALAPPDATA en Windows).
    # Apágala con TELEMETRY_ENABLED=false (sigue registrando en Logfire si hay token).
    telemetry_enabled: bool = True
    telemetry_dir: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de `Settings` (se lee `.env` una sola vez)."""
    return Settings()
