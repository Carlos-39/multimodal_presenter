"""Punto de entrada de la API FastAPI.

Hito 0: la app levanta y responde un health check. Nada de pipeline, modelo ni
lógica de negocio todavía (eso es Hito 2+).
"""

from fastapi import FastAPI

from .config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Transformador de información multimodal — trabajo de grado (Univalle).",
)


@app.get("/health", tags=["infra"])
def health() -> dict[str, str]:
    """Health check: confirma que la app está viva."""
    return {
        "status": "ok",
        "service": settings.logfire_service_name,
        "environment": settings.environment,
    }
