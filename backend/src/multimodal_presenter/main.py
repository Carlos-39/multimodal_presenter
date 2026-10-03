"""Punto de entrada de la API FastAPI.

Hito 0: la app levanta, responde un health check y emite trazas verificables a
Logfire. Nada de pipeline, modelo ni lógica de negocio todavía (eso es Hito 2+).
"""

from contextlib import asynccontextmanager

import logfire
from fastapi import FastAPI

from .api.auth import router as auth_router
from .api.routes import router as pipeline_router
from .config import get_settings
from .observability import configure_observability
from .storage import migrar

settings = get_settings()

# Observabilidad primero, para que la instrumentación de FastAPI la use.
configure_observability(settings)


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    """Deja el esquema al día antes de atender la primera petición.

    Se hace al arrancar y no en el primer uso para que un esquema a medias se note al levantar la
    aplicación, no delante de alguien que está intentando entrar. Es idempotente: arrancar dos
    veces no hace nada la segunda.

    La persistencia es OPCIONAL: la aplicación entera sigue funcionando sin cuenta, que es como
    corren las sesiones de evaluación del Hito 8. Esto solo prepara el sitio donde guardar.

    Los ajustes se leen AQUÍ y no se toma el `settings` de arriba, que quedó fijado al importar el
    módulo. Los endpoints los resuelven por dependencia en cada petición, así que si ambos no leen
    lo mismo se migra una base y se usa otra — que es exactamente lo que pasó al escribir los
    tests: tablas que no existían en la base contra la que corría la aplicación.
    """
    aplicadas = await migrar(get_settings())
    if aplicadas:
        logfire.info("esquema actualizado: {versiones}", versiones=aplicadas)
    yield


app = FastAPI(
    lifespan=ciclo_de_vida,
    title=settings.app_name,
    version="0.1.0",
    description="Transformador de información multimodal — trabajo de grado (Univalle).",
)

# Instrumenta FastAPI (span por request) y PydanticAI (llamadas al modelo, tokens, reintentos).
logfire.instrument_fastapi(app)
logfire.instrument_pydantic_ai()

app.include_router(pipeline_router)
app.include_router(auth_router)


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
