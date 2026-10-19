"""Telemetría de comportamiento (Hito 8), capa observacional, NO el contrato de datos.

Este schema vive aparte a propósito: NO importa ni referencia `Presentation`/`Section`/
`GroundingReport`. La telemetría observa la interacción, no modifica el pipeline.

El payload (`data`) solo admite primitivos cortos. Es una barrera *server-side* a la promesa de
privacidad del Hito 8: aunque el frontend se equivocara, un valor largo (contenido del documento,
texto de una pregunta) se rechaza aquí. Solo entran metadatos: enums, ordinales, longitudes, ms.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

TelemetryEventName = Literal[
    "session_start",
    "transform_submit",
    "detail_mode_change",
    "view_change",
    "suggested_question_click",
    "typed_question_submit",
    "source_open",
    "source_close",
    "session_end",
]

# Tope de longitud para claves y valores string del payload. Los enums/estados más largos que
# manejamos ("suggested_question_click", "not_found", "unverified") caben de sobra; cualquier cosa
# por encima es contenido colado y se rechaza.
_MAX_DATA_STR = 40
_MAX_DATA_KEYS = 12

Primitive = str | int | float | bool | None


class TelemetryEvent(BaseModel):
    """Un evento de comportamiento del usuario durante una sesión de evaluación."""

    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(min_length=1, max_length=64)
    participant: str | None = Field(default=None, max_length=32)
    name: TelemetryEventName
    ts: str = Field(min_length=1, max_length=40)  # ISO-8601 del reloj del cliente
    seq: int = Field(ge=0)  # contador monótono por sesión → orden inequívoco ante ms iguales
    data: dict[str, Primitive] = Field(default_factory=dict)

    @field_validator("data")
    @classmethod
    def _solo_metadatos(cls, value: dict[str, Primitive]) -> dict[str, Primitive]:
        """Rechaza payloads con demasiadas claves o strings largos (barrera anti-contenido)."""
        if len(value) > _MAX_DATA_KEYS:
            raise ValueError("payload de telemetría demasiado grande")
        for key, item in value.items():
            if len(key) > _MAX_DATA_STR:
                raise ValueError("clave de payload demasiado larga")
            if isinstance(item, str) and len(item) > _MAX_DATA_STR:
                raise ValueError("valor de payload demasiado largo (¿contenido colado?)")
        return value


class TelemetryBatch(BaseModel):
    """Lote de eventos (el frontend los envía agrupados, no uno por request).

    Los eventos entran SIN tipar y se validan **uno por uno** en `valid_events()`, a propósito.
    Con `list[TelemetryEvent]` un solo evento malo invalidaba el request completo y se perdían
    hasta 50 eventos buenos del mismo lote, en silencio: el frontend es fire-and-forget y no se
    enteraba. En una sesión de evaluación que no se puede repetir, eso es perder datos de verdad
    (se vio al añadir un evento nuevo mientras el backend seguía corriendo con el schema viejo:
    el lote entero respondía 422).

    La barrera de privacidad NO se relaja: cada evento pasa por el mismo `TelemetryEvent`
    estricto, así que un string largo (contenido colado) se sigue rechazando. Lo único que cambia
    es que ese rechazo ya no se lleva por delante a los eventos vecinos.
    """

    model_config = ConfigDict(extra="forbid")

    events: list[dict] = Field(min_length=1, max_length=100)

    def valid_events(self) -> tuple[list[TelemetryEvent], int]:
        """Devuelve (eventos válidos, cuántos se descartaron)."""
        validos: list[TelemetryEvent] = []
        descartados = 0
        for crudo in self.events:
            try:
                validos.append(TelemetryEvent.model_validate(crudo))
            except ValidationError:
                descartados += 1
        return validos, descartados
