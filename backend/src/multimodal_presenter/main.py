"""Punto de entrada de la API FastAPI.

Hito 0: la app levanta, responde un health check y emite trazas verificables a
Logfire. Nada de pipeline, modelo ni lógica de negocio todavía (eso es Hito 2+).
"""

import logfire
from fastapi import FastAPI

from .api.routes import router as pipeline_router
from .config import get_settings
from .observability import configure_observability

settings = get_settings()

# Observabilidad primero, para que la instrumentación de FastAPI la use.
configure_observability(settings)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Transformador de información multimodal — trabajo de grado (Univalle).",
)

# Instrumenta FastAPI (span por request) y PydanticAI (llamadas al modelo, tokens, reintentos).
logfire.instrument_fastapi(app)
logfire.instrument_pydantic_ai()

app.include_router(pipeline_router)


@app.get("/health", tags=["infra"])
def health() -> dict[str, str]:
    """Health check. Emite una traza explícita para verificar la observabilidad."""
    with logfire.span("health_check"):
        logfire.info("health check solicitado")
        return {
            "status": "ok",
            "service": settings.logfire_service_name,
            "environment": settings.environment,
        }
