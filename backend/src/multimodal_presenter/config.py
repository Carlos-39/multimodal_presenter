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

    # Modelo (PydanticAI). Primario: Anthropic. Fallback: Gemini DIRECTO (Google AI Studio).
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
    # Una sola clave de Google (AI Studio) cubre los DOS roles de Gemini en el sistema:
    #
    # 1. Fallback de la ESTRUCTURACIÓN (opcional; si falta, solo se usa el primario). Antes se
    #    llegaba al mismo Gemini a través de OpenRouter; ahora va directo — un intermediario
    #    menos y una clave menos que mantener.
    # 2. Percepción de AUDIO (Fase 0), que es obligatoria para aceptar audio: Sonnet no admite
    #    audio como modalidad de entrada en su API, así que la percepción se delega a un modelo
    #    con entrada acústica nativa y lo que entra a la Fase 2 es un `AudioEvidence` tipado
    #    (no una transcripción plana). Sin esta clave, /transform con audio da un 503 claro;
    #    el texto, el PDF y la imagen funcionan igual sin ella.
    #
    # La percepción NO tiene fallback a propósito. Es el mismo criterio por el que se descartó
    # estructurar el audio con Gemini: si la anotación cayera en silencio a otra familia de
    # modelos, su calidad cambiaría sin que nadie lo note — y esa anotación es justo el
    # instrumento que mide la mini-evaluación. Un error claro es más honesto que una
    # degradación invisible.
    google_api_key: str | None = None
    google_model: str = "gemini-3.1-pro-preview"  # fallback de estructuración (calidad Pro)
    google_perception_model: str = "gemini-3.8-flash"  # percepción de audio (Fase 0)

    # Verificación semántica de gráficos (Fase 3, 2ª llamada al LLM). Ponla en false durante
    # el desarrollo para NO gastar esa llamada extra en documentos con gráficos.
    semantic_verification_enabled: bool = True

    # Narración TTS (Hito 5g Parte 3) — OpenAI tts-1. Sin ella, /narration responde 503 y el
    # frontend lo muestra (nunca en silencio).
    openai_api_key: str | None = None
    openai_tts_model: str = "tts-1"
    openai_tts_voice: str = "nova"
    # Entrada por voz en el chat: transcripción audio→texto (misma clave OpenAI).
    openai_transcribe_model: str = "gpt-4o-mini-transcribe"
    # Generación de imágenes (ilustraciones 5h + deck 5j). La imagen debe entenderse SOLA: sin
    # texto y sin marcas que remitan a una leyenda que no existe (ver `illustration.py`).
    # PRIMARIO: Gemini. Pasó a serlo tras medirlo contra Ideogram con los mismos prompts: 0 de 6
    # imágenes con palabras inventadas frente a 3 de 6, y más barato. Respaldos: Ideogram y
    # OpenAI, que siguen cableados porque Gemini puede rechazar un prompt por filtros de
    # seguridad y una imagen peor es mejor que ninguna.
    google_image_model: str = "gemini-3.1-flash-image"
    google_image_aspect_ratio: str = "1:1"  # cuadrada, como la tarjeta donde se muestra
    google_image_size: str = "1K"  # fija el precio en $0.067/imagen (2K sube a $0.101)
    ideogram_api_key: str | None = None
    ideogram_rendering_speed: str = "QUALITY"  # TURBO ($0.03) | DEFAULT ($0.06) | QUALITY ($0.09)
    openai_image_model: str = "gpt-image-1"
    openai_image_quality: str = "high"  # fallback; "medium"/"low" para abaratar

    # Entrada multimodal (Hito 4): tope de tamaño de archivo subido, en MB.
    max_upload_mb: int = 20
    # Tope de DURACIÓN para entradas de audio. Los modelos de audio pierden fiabilidad en
    # grabaciones largas, así que el prototipo se acota explícitamente: si se excede, el
    # endpoint responde 413 con la duración real y el límite (nunca un fallo silencioso).
    max_audio_minutes: int = 15

    # Observabilidad (Logfire)
    logfire_token: str | None = None
    logfire_service_name: str = "multimodal-presenter-backend"

    # Telemetría de comportamiento (Hito 8). Se anexa a JSONL para análisis posterior.
    # `telemetry_dir` vacío → carpeta por defecto fuera de OneDrive (LOCALAPPDATA en Windows).
    # Apágala con TELEMETRY_ENABLED=false (sigue registrando en Logfire si hay token).
    telemetry_enabled: bool = True
    telemetry_dir: str | None = None

    # Cuentas. El registro viene CERRADO: en una URL pública, dejar crear cuentas a cualquiera no
    # aporta nada a este proyecto —las sesiones de evaluación corren sin cuenta— y sí añade una
    # puerta que vigilar. Se abre con REGISTRO_ABIERTO=true, que es lo que hace falta en local.
    # Entrar NO depende de esto: cerrar el registro no cierra el login.
    registro_abierto: bool = False
    # Cuántos proxies de confianza hay DELANTE de la aplicación. Decide de dónde se saca la
    # dirección de quien llama para el límite de intentos (ver `api/limites.ip_del_cliente`).
    # 0 = ignorar `x-forwarded-for` y usar el par de la conexión, que es lo correcto en local y lo
    # prudente mientras no se haya medido la cadena real del despliegue.
    proxies_confiables: int = 0

    # Persistencia (login + multi-sesión). `data_dir` vacío → carpeta por defecto FUERA de
    # OneDrive, igual que la telemetría y por el mismo motivo medido: OneDrive sincronizando un
    # archivo que se escribe en caliente corrompe bases SQLite.
    data_dir: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de `Settings` (se lee `.env` una sola vez)."""
    return Settings()
