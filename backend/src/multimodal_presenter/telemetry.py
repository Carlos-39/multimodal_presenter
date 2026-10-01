"""Registro de la telemetría de comportamiento (Hito 8).

Dos destinos, por diseño:
- **Logfire**, marcado con el atributo `ux=True` → se filtra del resto de trazas (spans de LLM y
  de pipeline, que genera la auto-instrumentación). Cada evento es un log *info* (un punto en el
  tiempo; la duración ya viene calculada en el payload), no un span.
- **JSONL local**, una línea por evento. Es el registro PRIMARIO para el análisis: Logfire está en
  modo "if-token-present" (sin token no envía), así que las sesiones de evaluación no pueden
  depender de él. El JSONL funciona sin red ni token y se cruza trivialmente con NASA-TLX.

La carpeta del JSONL vive FUERA de OneDrive y del repo por defecto (mismo criterio que los
experimentos del Hito 7): evita el ruido de sincronización y no arrastra datos de personas al git.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import logfire

from .config import Settings
from .schemas.telemetry import TelemetryEvent


def resolve_telemetry_dir(settings: Settings) -> Path | None:
    """Carpeta donde se anexan los JSONL, o None si la telemetría a disco está apagada.

    Precedencia: `TELEMETRY_DIR` explícito > un default fuera de OneDrive (LOCALAPPDATA en Windows,
    XDG_DATA_HOME o el home en otros SO). Apagable con `TELEMETRY_ENABLED=false`.
    """
    if not settings.telemetry_enabled:
        return None
    if settings.telemetry_dir:
        return Path(settings.telemetry_dir)
    base = os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_DATA_HOME") or str(Path.home())
    return Path(base) / "mmpresenter_telemetry"


def _jsonl_path(directory: Path) -> Path:
    """Un archivo por día (UTC). Cada línea es un evento."""
    day = datetime.now(UTC).strftime("%Y%m%d")
    return directory / f"ux-{day}.jsonl"


def record_ux_event(event: TelemetryEvent, *, jsonl_dir: Path | None) -> None:
    """Registra un evento en Logfire (ux=True) y, si hay carpeta, lo anexa al JSONL del día.

    Nunca lanza por un fallo de escritura: la telemetría es observacional y jamás debe tumbar una
    respuesta al usuario. Si el disco falla, se registra el problema en Logfire y se sigue.
    """
    attrs: dict[str, object] = {
        "ux": True,  # ← filtro único para separar telemetría de las trazas técnicas
        "event": event.name,
        "session_id": event.session_id,
        "seq": event.seq,
    }
    if event.participant:
        attrs["participant"] = event.participant
    # Prefijo `d_` para las claves del payload: evita colisiones con los campos del sobre.
    for key, item in event.data.items():
        attrs[f"d_{key}"] = item
    logfire.info("ux.{event}", **attrs)

    if jsonl_dir is None:
        return
    try:
        jsonl_dir.mkdir(parents=True, exist_ok=True)
        record = event.model_dump()
        record["received_at"] = datetime.now(UTC).isoformat()  # sello del servidor
        with _jsonl_path(jsonl_dir).open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    except OSError as exc:  # disco lleno, permisos, etc. → no rompas la telemetría
        logfire.warning("telemetría: no se pudo anexar al JSONL: {error}", error=str(exc))
