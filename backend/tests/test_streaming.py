"""Tests del pipeline en streaming (Hito 5d), con LLM mockeado."""

import asyncio

from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model
from multimodal_presenter.main import app
from multimodal_presenter.pipeline.streaming import SectionEmitter, transform_stream
from multimodal_presenter.schemas import Presentation


def _section(sid: str) -> dict:
    return {
        "id": sid,
        "role": "core",
        "source": {"document_id": "d", "quote": "q"},
        "content": {"content_type": "text", "text": "t"},
    }


def _pres(*ids: str) -> Presentation:
    return Presentation.model_validate({"title": "t", "sections": [_section(i) for i in ids]})


# --- SectionEmitter: la lógica de "sección completa" con partials simulados (sin LLM) ---
def test_emitter_emits_when_next_starts() -> None:
    emitter = SectionEmitter()
    assert emitter.take(_pres("a"), final=False) == []  # una sola: la última aún no
    assert [s.id for s in emitter.take(_pres("a", "b"), final=False)] == [
        "a"
    ]  # 'b' empezó → 'a' lista
    assert [s.id for s in emitter.take(_pres("a", "b"), final=True)] == ["b"]  # flush final


def test_emitter_all_at_end_if_final_first() -> None:
    emitter = SectionEmitter()
    got = emitter.take(_pres("a", "b", "c"), final=True)
    assert [s.id for s in got] == ["a", "b", "c"]


async def _collect(gen):
    return [event async for event in gen]


# --- transform_stream: secuencia de eventos ---
def test_transform_stream_event_sequence(input_text: str, mock_presentation: dict) -> None:
    model = TestModel(custom_output_args=mock_presentation)
    events = asyncio.run(_collect(transform_stream(model, text=input_text)))

    types = [e.type for e in events]
    assert types[0] == "start"
    assert types.count("section") == 2  # las 2 secciones del mock
    assert types[-1] == "done"

    # Cada sección streameada trae su grounding (Caso A: offsets calculados).
    sec_events = [e for e in events if e.type == "section"]
    assert sec_events[0].grounding.status == "verified"
    assert sec_events[0].section.source.char_start is not None

    done = events[-1]
    assert done.grounding.total_sections == 2


# --- Endpoint SSE ---
def test_stream_endpoint_emits_sse(input_text: str, mock_presentation: dict) -> None:
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_args=mock_presentation)
    try:
        client = TestClient(app)
        response = client.post("/transform/stream", data={"text": input_text})
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        body = response.text
        assert '"type":"section"' in body
        assert '"type":"done"' in body
    finally:
        app.dependency_overrides.clear()


def test_stream_endpoint_rejects_empty() -> None:
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_args={})
    try:
        client = TestClient(app)
        response = client.post("/transform/stream", data={})
        assert response.status_code == 400  # validación antes del stream
    finally:
        app.dependency_overrides.clear()
