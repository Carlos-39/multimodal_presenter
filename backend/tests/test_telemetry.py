"""Tests de la telemetría de comportamiento (Hito 8, Parte A).

Cubren: el endpoint escribe el JSONL, la barrera server-side de privacidad (strings largos y
campos extra se rechazan), el apagado a disco, y la agregación de tiempo por modo del exportador.
"""

import json

import pytest
from fastapi.testclient import TestClient

from multimodal_presenter.config import Settings, get_settings
from multimodal_presenter.main import app


def _client(tmp_path, *, enabled: bool = True) -> TestClient:
    app.dependency_overrides[get_settings] = lambda: Settings(
        telemetry_dir=str(tmp_path), telemetry_enabled=enabled, logfire_token=""
    )
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def _event(name: str, seq: int, data: dict | None = None) -> dict:
    return {
        "session_id": "sess-abc",
        "participant": "P03",
        "name": name,
        "ts": "2026-09-30T10:00:00.000Z",
        "seq": seq,
        "data": data or {},
    }


def _read_jsonl(tmp_path) -> list[dict]:
    lines: list[dict] = []
    for path in tmp_path.glob("ux-*.jsonl"):
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                lines.append(json.loads(line))
    return lines


def test_batch_se_escribe_al_jsonl(tmp_path) -> None:
    client = _client(tmp_path)
    batch = {
        "events": [
            _event("session_start", 0),
            _event(
                "detail_mode_change",
                1,
                {"from": "summary", "to": "detailed", "ms_in_from": 4200, "section_ordinal": 2},
            ),
            _event(
                "source_open",
                2,
                {"origin": "section", "grounding_status": "not_found", "section_ordinal": 2},
            ),
        ]
    }
    response = client.post("/telemetry", json=batch)
    assert response.status_code == 204

    written = _read_jsonl(tmp_path)
    assert len(written) == 3
    assert {e["name"] for e in written} == {"session_start", "detail_mode_change", "source_open"}
    # El servidor sella su propia hora de recepción sin pisar el ts del cliente.
    assert all("received_at" in e for e in written)
    assert written[0]["ts"] == "2026-09-30T10:00:00.000Z"


def test_privacidad_rechaza_string_largo(tmp_path) -> None:
    """Un valor largo en el payload (contenido colado) se rechaza server-side (422)."""
    client = _client(tmp_path)
    colado = {"events": [_event("typed_question_submit", 0, {"texto": "x" * 200})]}
    response = client.post("/telemetry", json=colado)
    assert response.status_code == 422
    assert _read_jsonl(tmp_path) == []  # nada se escribió


def test_privacidad_rechaza_campo_extra(tmp_path) -> None:
    client = _client(tmp_path)
    malo = _event("session_start", 0)
    malo["ip_address"] = "1.2.3.4"  # no forma parte del sobre → extra="forbid"
    response = client.post("/telemetry", json={"events": [malo]})
    assert response.status_code == 422


def test_lote_vacio_es_422(tmp_path) -> None:
    client = _client(tmp_path)
    assert client.post("/telemetry", json={"events": []}).status_code == 422


def test_nombre_de_evento_invalido_es_422(tmp_path) -> None:
    client = _client(tmp_path)
    assert client.post("/telemetry", json={"events": [_event("hackeo", 0)]}).status_code == 422


def test_disco_apagado_no_escribe_pero_responde_204(tmp_path) -> None:
    client = _client(tmp_path, enabled=False)
    response = client.post("/telemetry", json={"events": [_event("session_start", 0)]})
    assert response.status_code == 204
    assert _read_jsonl(tmp_path) == []


def test_exportador_agrega_tiempo_por_modo() -> None:
    """El resumen suma bien ms en resumen vs. detallado (cambios + el tramo final)."""
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from export_telemetry import _summarize  # noqa: PLC0415 (script fuera del paquete)

    events = [
        _event("session_start", 0),
        _event("detail_mode_change", 1, {"from": "summary", "to": "detailed", "ms_in_from": 3000}),
        _event("detail_mode_change", 2, {"from": "detailed", "to": "summary", "ms_in_from": 5000}),
        _event(
            "suggested_question_click",
            3,
            {"section_ordinal": 1, "suggestion_index": 0, "question_len": 40},
        ),
        _event("typed_question_submit", 4, {"section_ordinal": 1, "question_len": 22}),
        _event("source_open", 5, {"origin": "chat", "grounding_status": "verified"}),
        _event("session_end", 6, {"final_mode": "summary", "ms_in_final_mode": 2000}),
    ]
    out = Path(__file__).resolve().parent / "_tmp_summary.csv"
    try:
        rows = _summarize(events, out)
    finally:
        out.unlink(missing_ok=True)

    assert len(rows) == 1
    row = rows[0]
    # `from` es el modo que se ABANDONA. Entró en summary (default):
    #   cambio1 deja summary (3000) → summary; cambio2 deja detailed (5000) → detailed;
    #   tramo final en summary (2000) → summary. Total summary = 5000, detailed = 5000.
    assert row["ms_summary"] == 5000
    assert row["ms_detailed"] == 5000
    assert row["pct_detailed"] == 50
    assert row["n_suggested"] == 1
    assert row["n_typed"] == 1
    assert row["n_source_open"] == 1
    assert row["src_verified"] == 1
    assert row["src_from_chat"] == 1
    assert row["participant"] == "P03"
