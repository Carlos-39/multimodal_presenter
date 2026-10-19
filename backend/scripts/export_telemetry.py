"""Exporta la telemetría de comportamiento (Hito 8) a CSV para análisis.

Lee los JSONL que deja el backend (`telemetry.record_ux_event`) y produce dos archivos:
- `telemetry_raw.csv`   ( un evento por fila (auditoría, orden por sesión y TIEMPO).
- `telemetry_summary.csv` ) una fila por sesión: los agregados que se cruzan con NASA-TLX y la
  prueba de comprensión (tiempo en resumen vs. detallado, sugeridas vs. propias, verificaciones
  de fuente por estado de grounding, etc.).

Uso (desde backend/):
    uv run python scripts/export_telemetry.py
    uv run python scripts/export_telemetry.py --dir <carpeta_jsonl> --out <carpeta_salida>

Sin argumentos usa la misma carpeta por defecto que el backend (fuera de OneDrive).
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from multimodal_presenter.config import get_settings
from multimodal_presenter.telemetry import resolve_telemetry_dir


def _load_events(jsonl_dir: Path) -> tuple[list[dict[str, Any]], int]:
    """Lee todos los `ux-*.jsonl` de la carpeta y descarta los repetidos.

    Devuelve (eventos, cuántos se descartaron).

    Hay repetidos porque el cliente reintenta: un lote que no se confirma vuelve a la cola y se
    manda otra vez, y puede haber llegado igualmente la primera vez (la respuesta se perdió, no la
    petición). Ese reenvío es deliberado ( perder eventos es peor que contarlos dos veces) pero
    quien analiza no debería pagarlo.

    La clave es (sesión, seq, nombre, instante) y NO (sesión, seq) a secas, que sería lo obvio y
    estaría mal: el cliente antiguo reiniciaba `seq` en 0 al recargar la pestaña, así que en los
    JSONL ya recogidos una misma sesión tiene varios eventos legítimos en seq 0, 1, 2… Con la
    clave corta, este exportador los borraría. Un reenvío repite el evento entero, instante
    incluido; una recarga no.
    """
    events: list[dict[str, Any]] = []
    vistos: set[tuple[Any, ...]] = set()
    repetidos = 0
    for path in sorted(jsonl_dir.glob("ux-*.jsonl")):
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue  # una línea a medio escribir no invalida el resto
                clave = (
                    event.get("session_id"),
                    event.get("seq"),
                    event.get("name"),
                    event.get("ts"),
                )
                if clave in vistos:
                    repetidos += 1
                    continue
                vistos.add(clave)
                events.append(event)
    return events, repetidos


def _parse_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


_LEJANO = datetime.max.replace(tzinfo=UTC)


def _orden(event: dict[str, Any]) -> tuple[str, datetime, int]:
    """Clave de orden: sesión, luego TIEMPO, y `seq` solo para desempatar.

    Ordenar por `seq` a secas no basta con los datos ya recogidos: el cliente antiguo reiniciaba
    el contador en cada recarga de la pestaña mientras el id de sesión sobrevivía, así que hay
    sesiones con varios eventos en seq 0, 1, 2… El sello de tiempo es la verdad de terreno y no
    depende de ese detalle del cliente; `seq` queda como desempate para eventos del mismo ms.
    """
    return (
        event.get("session_id", ""),
        _parse_ts(event.get("ts")) or _LEJANO,
        int(event.get("seq", 0) or 0),
    )


def _primero_por_tiempo(eventos: list[dict[str, Any]]) -> dict[str, Any] | None:
    """El evento más TEMPRANO de la lista (no el primero que aparezca al ordenar por `seq`)."""
    con_ts = [(e, _parse_ts(e.get("ts"))) for e in eventos]
    fechados = [(e, t) for e, t in con_ts if t is not None]
    if not fechados:
        return eventos[0] if eventos else None
    return min(fechados, key=lambda par: par[1])[0]


def _write_raw(events: list[dict[str, Any]], out: Path) -> None:
    ordered = sorted(events, key=_orden)
    # Reúne todas las claves de payload presentes, para columnas estables.
    data_keys: set[str] = set()
    for event in ordered:
        data_keys.update((event.get("data") or {}).keys())
    fields = ["session_id", "participant", "seq", "name", "ts", "received_at"]
    fields += [f"d_{k}" for k in sorted(data_keys)]
    with out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for event in ordered:
            row = {k: event.get(k) for k in ("session_id", "participant", "seq", "name", "ts")}
            row["received_at"] = event.get("received_at")
            for key, value in (event.get("data") or {}).items():
                row[f"d_{key}"] = value
            writer.writerow(row)


def _summarize(events: list[dict[str, Any]], out: Path) -> list[dict[str, Any]]:
    by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        by_session[event.get("session_id", "")].append(event)

    rows: list[dict[str, Any]] = []
    for session_id, evs in sorted(by_session.items()):
        evs.sort(key=_orden)
        data = lambda e: e.get("data") or {}  # noqa: E731 (helper local, legible)

        # El reloj del cliente reparte la sesión en TRAMOS sin huecos: `summary`, `detailed` y
        # `deck` (la presentación generada, donde el nivel de detalle no filtra nada). Se acumulan
        # por separado para que el tiempo del deck no se le sume a un modo de lectura.
        tramos = {"summary": 0.0, "detailed": 0.0, "deck": 0.0}
        for e in evs:
            if e["name"] == "detail_mode_change":
                bucket = data(e).get("from")
                ms = float(data(e).get("ms_in_from", 0) or 0)
            elif e["name"] == "session_end":
                bucket = data(e).get("final_mode")
                ms = float(data(e).get("ms_in_final_mode", 0) or 0)
            else:
                continue
            if bucket in tramos:
                tramos[bucket] += ms
        ms_summary, ms_detailed, ms_deck = (
            tramos["summary"],
            tramos["detailed"],
            tramos["deck"],
        )

        cambios = [e for e in evs if e["name"] == "detail_mode_change"]
        modos = ("summary", "detailed")
        # Un "toggle de detalle" es pasar de un modo de lectura a OTRO. Entrar o salir del deck usa
        # el mismo evento (para que el reparto de tiempo cuadre) pero no es un cambio de detalle.
        n_toggles = sum(
            1 for e in cambios if data(e).get("from") in modos and data(e).get("to") in modos
        )
        n_deck = sum(1 for e in cambios if data(e).get("to") == "deck")
        n_slides = sum(
            1 for e in evs if e["name"] == "view_change" and data(e).get("to") == "slides"
        )

        source_opens = [e for e in evs if e["name"] == "source_open"]
        by_status = defaultdict(int)
        by_origin = defaultdict(int)
        for e in source_opens:
            by_status[data(e).get("grounding_status", "?")] += 1
            by_origin[data(e).get("origin", "?")] += 1

        # Por tiempo, no por posición: una recarga en medio de la sesión mete un segundo
        # `session_start` y reinicia `seq`, y entonces "el primero de la lista" podía ser un
        # evento POSTERIOR en el reloj. El arranque es el más temprano; la primera pregunta,
        # también: si no, `ms_to_first_question` mide hasta una pregunta que no es la primera.
        arranques = [e for e in evs if e["name"] == "session_start"]
        start = _primero_por_tiempo(arranques)
        start_ts = _parse_ts(start.get("ts")) if start else None
        first_q = _primero_por_tiempo(
            [e for e in evs if e["name"] in ("typed_question_submit", "suggested_question_click")]
        )
        ms_to_first_q: float | str = ""
        if start_ts and first_q:
            first_ts = _parse_ts(first_q.get("ts"))
            if first_ts:
                ms_to_first_q = round((first_ts - start_ts).total_seconds() * 1000)

        participant = next((e.get("participant") for e in evs if e.get("participant")), "")
        rows.append(
            {
                "session_id": session_id,
                "participant": participant,
                "n_events": len(evs),
                # Un `session_start` extra = una recarga de la pestaña. Se expone para que
                # una fila con `n_events` inflado se explique sola al analizarla.
                "n_reloads": max(0, len(arranques) - 1),
                "n_transforms": sum(1 for e in evs if e["name"] == "transform_submit"),
                "ms_summary": round(ms_summary),
                "ms_detailed": round(ms_detailed),
                "ms_deck": round(ms_deck),
                # Reparto ENTRE LOS DOS MODOS DE LECTURA: el deck queda fuera del denominador a
                # propósito, porque ahí no hay modo. Su tiempo se reporta aparte, en `ms_deck`.
                "pct_detailed": (
                    round(100 * ms_detailed / (ms_summary + ms_detailed))
                    if (ms_summary + ms_detailed) > 0
                    else ""
                ),
                "n_detail_toggles": n_toggles,
                "n_deck_opens": n_deck,
                "n_slides_opens": n_slides,
                "n_suggested": sum(1 for e in evs if e["name"] == "suggested_question_click"),
                "n_typed": sum(1 for e in evs if e["name"] == "typed_question_submit"),
                "n_source_open": len(source_opens),
                "src_verified": by_status.get("verified", 0),
                "src_unverified": by_status.get("unverified", 0),
                "src_not_found": by_status.get("not_found", 0),
                "src_from_section": by_origin.get("section", 0),
                "src_from_chat": by_origin.get("chat", 0),
                "src_from_deck": by_origin.get("deck", 0),
                "ms_to_first_question": ms_to_first_q,
            }
        )

    if rows:
        with out.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    return rows


def main() -> None:
    # La consola de Windows suele ser cp1252 y revienta con '→'/acentos. Forzamos UTF-8 tolerante
    # (mismo criterio que el arnés del Hito 7).
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Exporta la telemetría del Hito 8 a CSV.")
    parser.add_argument("--dir", type=Path, default=None, help="Carpeta con los JSONL.")
    parser.add_argument("--out", type=Path, default=None, help="Carpeta de salida (CSV).")
    args = parser.parse_args()

    jsonl_dir = args.dir or resolve_telemetry_dir(get_settings())
    if jsonl_dir is None:
        raise SystemExit("Telemetría a disco apagada (TELEMETRY_ENABLED=false) y sin --dir.")
    if not jsonl_dir.exists():
        raise SystemExit(f"No existe la carpeta de telemetría: {jsonl_dir}")

    out_dir = args.out or jsonl_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    events, repetidos = _load_events(jsonl_dir)
    if not events:
        raise SystemExit(f"No hay eventos en {jsonl_dir}")

    raw_path = out_dir / "telemetry_raw.csv"
    summary_path = out_dir / "telemetry_summary.csv"
    _write_raw(events, raw_path)
    rows = _summarize(events, summary_path)

    print(f"Leídos {len(events)} eventos de {jsonl_dir}")
    if repetidos:
        print(f"  (se descartaron {repetidos} reenviados, ya contados)")
    print(f"  crudo   → {raw_path}")
    print(f"  resumen → {summary_path} ({len(rows)} sesiones)")


if __name__ == "__main__":
    main()
