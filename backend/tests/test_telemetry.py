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


def test_privacidad_descarta_string_largo(tmp_path) -> None:
    """Un valor largo en el payload (contenido colado) NO se escribe nunca.

    La garantía de privacidad es que no llegue a disco, no que el request falle: el descarte es
    por evento (ver `test_un_evento_malo_no_tumba_el_lote`).
    """
    client = _client(tmp_path)
    colado = {"events": [_event("typed_question_submit", 0, {"texto": "x" * 200})]}
    response = client.post("/telemetry", json=colado)
    assert response.status_code == 204
    assert _read_jsonl(tmp_path) == []  # nada se escribió: la barrera sigue en pie


def test_privacidad_descarta_campo_extra(tmp_path) -> None:
    client = _client(tmp_path)
    malo = _event("session_start", 0)
    malo["ip_address"] = "1.2.3.4"  # no forma parte del sobre → extra="forbid"
    assert client.post("/telemetry", json={"events": [malo]}).status_code == 204
    assert _read_jsonl(tmp_path) == []


def test_lote_vacio_es_422(tmp_path) -> None:
    """El lote vacío sí es un 422: es el SOBRE el que está mal, no un evento de dentro."""
    client = _client(tmp_path)
    assert client.post("/telemetry", json={"events": []}).status_code == 422


def test_nombre_de_evento_invalido_se_descarta(tmp_path) -> None:
    client = _client(tmp_path)
    assert client.post("/telemetry", json={"events": [_event("hackeo", 0)]}).status_code == 204
    assert _read_jsonl(tmp_path) == []


def test_un_evento_malo_no_tumba_el_lote(tmp_path) -> None:
    """Los eventos buenos del lote se guardan aunque venga uno malo con ellos.

    Con `list[TelemetryEvent]` el request entero respondía 422 y se perdían hasta 50 eventos
    buenos, en silencio (el frontend es fire-and-forget). Se vio de verdad al añadir un evento
    nuevo mientras el backend seguía corriendo con el schema anterior. En una sesión de
    evaluación que no se puede repetir, eso es perder datos.
    """
    client = _client(tmp_path)
    lote = {
        "events": [
            _event("session_start", 0),
            _event("inventado", 1),  # nombre que este backend no conoce
            _event("typed_question_submit", 2, {"texto": "x" * 200}),  # contenido colado
            _event("source_open", 3, {"origin": "section", "grounding_status": "verified"}),
        ]
    }
    assert client.post("/telemetry", json=lote).status_code == 204
    guardados = _read_jsonl(tmp_path)
    assert [e["name"] for e in guardados] == ["session_start", "source_open"]


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


def _ev_ts(name: str, seq: int, ts: str, data: dict | None = None) -> dict:
    """Evento con sello de tiempo explícito (para los casos donde el ORDEN es lo que se prueba)."""
    return {
        "session_id": "sess-recarga",
        "participant": "P03",
        "name": name,
        "ts": ts,
        "seq": seq,
        "data": data or {},
    }


def test_exportador_ordena_por_tiempo_aunque_se_repita_el_seq() -> None:
    """Una recarga en medio de la sesión no debe falsear `ms_to_first_question`.

    El id de sesión vive en `sessionStorage` y sobrevive a una recarga de la pestaña; el cliente
    antiguo, en cambio, reiniciaba `seq` en 0. Resultado: una misma sesión con dos eventos en
    seq 0, dos en seq 1… Ordenando por `seq` a secas, un evento POSTERIOR en el reloj (seq bajo,
    tras la recarga) se colaba por delante de uno ANTERIOR (seq alto, antes de la recarga), y
    "la primera pregunta" salía siendo la que no era. Aquí la pregunta real llega a los 30 s;
    ordenando por `seq` se mediría la de los 70 s.

    Se arregló en el cliente (contador persistido), pero el exportador tiene que seguir siendo
    correcto con los JSONL YA recogidos: ordena por tiempo y toma los extremos por tiempo.
    """
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from export_telemetry import _summarize  # noqa: PLC0415 (script fuera del paquete)

    events = [
        # Antes de la recarga: la pregunta real, en un seq alto.
        _ev_ts("session_start", 0, "2026-09-30T10:00:00.000Z"),
        _ev_ts("transform_submit", 1, "2026-09-30T10:00:05.000Z", {"source_kind": "pdf"}),
        _ev_ts("typed_question_submit", 5, "2026-09-30T10:00:30.000Z", {"question_len": 20}),
        # Recarga: el contador vuelve a 0 con la MISMA sesión.
        _ev_ts("session_start", 0, "2026-09-30T10:01:00.000Z"),
        _ev_ts(
            "suggested_question_click",
            1,
            "2026-09-30T10:01:10.000Z",
            {"suggestion_index": 0, "question_len": 30},
        ),
    ]
    out = Path(__file__).resolve().parent / "_tmp_recarga.csv"
    try:
        rows = _summarize(events, out)
    finally:
        out.unlink(missing_ok=True)

    (row,) = rows
    assert row["ms_to_first_question"] == 30_000  # la de las 10:00:30, no la de las 10:01:10
    assert row["n_reloads"] == 1  # el `session_start` de más se reporta, no se esconde
    assert row["n_typed"] == 1 and row["n_suggested"] == 1  # no se pierde ningún evento


def test_exportador_separa_el_tiempo_de_la_presentacion_generada() -> None:
    """El tiempo en la presentación generada no se le suma a un modo de lectura.

    En esa vista el nivel de detalle no filtra nada (tiene sus propias diapositivas), así que
    contarlo como "resumen" o "detallado" sería atribuirlo a un modo que no estaba actuando — y
    ese reparto es una medida central de la RQ3. El reloj del cliente lo trata como un tramo
    propio, reusando el mismo evento para que la suma siga cubriendo la sesión completa.
    """
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from export_telemetry import _summarize  # noqa: PLC0415 (script fuera del paquete)

    events = [
        _event("session_start", 0),
        _event("detail_mode_change", 1, {"from": "summary", "to": "detailed", "ms_in_from": 4000}),
        # Abre la presentación generada: cierra el tramo de "detallado"…
        _event("detail_mode_change", 2, {"from": "detailed", "to": "deck", "ms_in_from": 6000}),
        _event("source_open", 3, {"origin": "deck", "grounding_status": "unverified"}),
        # …y al salir vuelve a "detallado", reportando lo que duró el deck.
        _event("detail_mode_change", 4, {"from": "deck", "to": "detailed", "ms_in_from": 9000}),
        _event("view_change", 5, {"to": "slides"}),
        _event("session_end", 6, {"final_mode": "detailed", "ms_in_final_mode": 1000}),
    ]
    out = Path(__file__).resolve().parent / "_tmp_deck.csv"
    try:
        (row,) = _summarize(events, out)
    finally:
        out.unlink(missing_ok=True)

    assert row["ms_summary"] == 4000
    assert row["ms_detailed"] == 7000  # 6000 + 1000: el deck NO entra aquí
    assert row["ms_deck"] == 9000  # su propio tramo, reportado aparte
    # El reparto es entre los dos modos de LECTURA; el deck queda fuera del denominador.
    assert row["pct_detailed"] == 64  # 7000 / 11000
    # Entrar y salir del deck usa el mismo evento, pero no es un cambio de nivel de detalle.
    assert row["n_detail_toggles"] == 1
    assert row["n_deck_opens"] == 1
    assert row["n_slides_opens"] == 1
    # Y el clic en la fuente desde una diapositiva generada ya no se cuenta como si fuera del chat.
    assert row["src_from_deck"] == 1
    assert row["src_from_chat"] == 0


def test_exportador_descarta_reenviados_pero_respeta_el_seq_repetido(tmp_path) -> None:
    """El reintento del cliente duplica eventos; una recarga vieja repite `seq` sin duplicar nada.

    Son dos cosas distintas y la clave de deduplicación tiene que distinguirlas. El cliente
    reintenta un lote que no se confirmó, y ese lote puede haber llegado igualmente (se perdió la
    respuesta, no la petición): ahí el evento viene REPETIDO ENTERO, instante incluido.

    Pero en los JSONL ya recogidos hay sesiones con varios eventos legítimos en seq 0, 1, 2…
    porque el cliente antiguo reiniciaba el contador al recargar la pestaña. Deduplicar por
    (sesión, seq) a secas —lo obvio— borraría esos. Por eso la clave lleva también nombre e
    instante.
    """
    import json
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    from export_telemetry import _load_events  # noqa: PLC0415 (script fuera del paquete)

    def linea(nombre: str, seq: int, ts: str, sesion: str = "s1") -> str:
        return json.dumps(
            {"session_id": sesion, "participant": "P01", "name": nombre, "seq": seq, "ts": ts,
             "data": {}}
        )

    (tmp_path / "ux-1.jsonl").write_text(
        "\n".join(
            [
                linea("session_start", 0, "2026-10-12T10:00:00.000Z"),
                # El reenvío: el mismo evento otra vez, idéntico.
                linea("session_start", 0, "2026-10-12T10:00:00.000Z"),
                # La recarga del cliente antiguo: mismo seq, otro evento de verdad.
                linea("view_change", 0, "2026-10-12T10:05:00.000Z"),
                # Y otra sesión con el mismo seq, que tampoco es un duplicado.
                linea("session_start", 0, "2026-10-12T10:00:00.000Z", sesion="s2"),
            ]
        ),
        encoding="utf-8",
    )

    eventos, repetidos = _load_events(tmp_path)

    assert repetidos == 1, "solo el reenviado exacto sobra"
    assert len(eventos) == 3
    assert [(e["session_id"], e["name"]) for e in eventos] == [
        ("s1", "session_start"),
        ("s1", "view_change"),
        ("s2", "session_start"),
    ]
