"""Integración con Pydantic Logfire (observabilidad desde el Hito 0).

Diseño intencional: si no hay `LOGFIRE_TOKEN`, la app NO falla al arrancar.
Logfire queda configurado en modo "solo si hay token" — sin token, las trazas se
generan pero no se envían (útil en local/CI); con token, se envían al dashboard.
"""

import logfire

from .config import Settings


def configure_observability(settings: Settings) -> None:
    """Configura Logfire para toda la aplicación.

    Debe llamarse una sola vez, al construir la app, antes de instrumentar FastAPI.
    """
    logfire.configure(
        token=settings.logfire_token,
        service_name=settings.logfire_service_name,
        environment=settings.environment,
        # Envía trazas solo si hay token; sin token no rompe el arranque local/CI.
        send_to_logfire="if-token-present",
    )
