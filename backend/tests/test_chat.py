"""Tests del chat anclado a fuentes (Hito 6) con el LLM mockeado."""

import asyncio
import json

from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model
from multimodal_presenter.main import app
from multimodal_presenter.pipeline.chat import chat_stream
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.validation import ground_quote

# Substring EXACTO del INPUT_TEXT de conftest → grounding verificado.
QUOTE_OK = "En 2023 las ventas fueron 100 y en 2024 fueron 150."


def _answer(text: str, *, quote: str | None = None, page: int | None = None) -> dict:
    """Argumentos de un ChatAnswer para TestModel.

    Son argumentos y no texto porque el chat usa `ToolOutput`: el modelo rellena los parámetros de
    una herramienta en vez de escribir JSON dentro de su respuesta. Ese cambio existe porque lo
    segundo fallaba en producción con las preguntas cortas.
    """
    return {
        "content": {"content_type": "text", "text": text},
        "source_quote": quote,
        "source_page": page,
    }


def _clarify(question: str, options: list[str]) -> dict:
    """ChatAnswer que PIDE aclaración (opción D) en vez de responder."""
    return {
        "content": {"content_type": "text", "text": question},
        "source_quote": None,
        "source_page": None,
        "clarification": {"question": question, "options": options},
    }


async def _collect(gen):
    return [event async for event in gen]


# ── ground_quote: la Fase 3 determinista reusada por el chat ──
def test_ground_quote_verified_in_text(input_text: str) -> None:
    ext = prepare_input(text=input_text)
    ancla = ground_quote(QUOTE_OK, None, ext)
    assert ancla.status == "verified"
    assert ancla.source is not None and ancla.source.char_start is not None


def test_ground_quote_not_found_when_quote_absent(input_text: str) -> None:
    ext = prepare_input(text=input_text)
    ancla = ground_quote("esta cita no existe en el documento", None, ext)
    assert ancla.status == "not_found"
    assert ancla.source is not None and ancla.source.char_start is None


def test_ground_quote_no_quote_is_ungrounded(input_text: str) -> None:
    ext = prepare_input(text=input_text)
    ancla = ground_quote(None, None, ext)
    assert ancla.source is None and ancla.status == "not_found"


def test_ground_quote_binary_is_unverified_with_page(pdf_bytes: bytes) -> None:
    ext = prepare_input(binary=pdf_bytes, media_type="application/pdf")
    ancla = ground_quote("cualquier cosa", 2, ext)
    assert ancla.status == "unverified"
    assert ancla.source is not None and ancla.source.page == 2


# ── chat_stream: eventos y anclaje ──
def test_chat_stream_ends_with_grounded_done(input_text: str) -> None:
    model = TestModel(custom_output_args=_answer("La empresa vendió 150 en 2024.", quote=QUOTE_OK))
    ext = prepare_input(text=input_text)
    events = asyncio.run(_collect(chat_stream(model, extraction=ext, history=[], question="¿?")))

    assert events[-1].type == "done"
    response = events[-1].response
    assert response.grounding == "verified"
    assert response.source is not None and response.source.char_start is not None
    assert response.content.content_type == "text"


def test_chat_stream_ungrounded_when_no_quote(input_text: str) -> None:
    model = TestModel(custom_output_args=_answer("No encuentro eso en el documento.", quote=None))
    ext = prepare_input(text=input_text)
    events = asyncio.run(_collect(chat_stream(model, extraction=ext, history=[], question="¿?")))
    done = events[-1]
    assert done.response.grounding == "not_found"
    assert done.response.source is None


# ── Opción D: Cognitive Forcing Function (pedido de aclaración) ──
def test_chat_stream_clarification_is_not_an_answer(input_text: str) -> None:
    model = TestModel(
        custom_output_args=_clarify("¿Te refieres a 2023 o a 2024?", ["2023", "2024"])
    )
    ext = prepare_input(text=input_text)
    events = asyncio.run(
        _collect(chat_stream(model, extraction=ext, history=[], question="¿y el otro?"))
    )
    done = events[-1]
    assert done.type == "done"
    # Un pedido de aclaración NO es una respuesta anclada: sin fuente, grounding not_found.
    assert done.response.clarification is not None
    assert done.response.clarification.question == "¿Te refieres a 2023 o a 2024?"
    assert done.response.clarification.options == ["2023", "2024"]
    assert done.response.source is None
    assert done.response.grounding == "not_found"


# ── Endpoint SSE ──
def test_chat_stream_endpoint_emits_sse(input_text: str) -> None:
    app.dependency_overrides[get_model] = lambda: TestModel(
        custom_output_args=_answer("R.", quote=QUOTE_OK)
    )
    try:
        client = TestClient(app)
        response = client.post(
            "/chat/stream", data={"text": input_text, "question": "¿cuánto vendió en 2024?"}
        )
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert '"type":"done"' in response.text
        assert '"grounding":"verified"' in response.text
    finally:
        app.dependency_overrides.clear()


def test_chat_stream_endpoint_rejects_empty_question(input_text: str) -> None:
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_args=_answer("x"))
    try:
        client = TestClient(app)
        response = client.post("/chat/stream", data={"text": input_text, "question": "   "})
        assert response.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_chat_stream_endpoint_rejects_bad_history(input_text: str) -> None:
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_args=_answer("x"))
    try:
        client = TestClient(app)
        response = client.post(
            "/chat/stream",
            data={"text": input_text, "question": "q", "history": "esto no es json"},
        )
        assert response.status_code == 400
    finally:
        app.dependency_overrides.clear()


# ── Sugerencias ──
def test_chat_suggestions_caps_at_three(input_text: str, mock_presentation: dict) -> None:
    section = mock_presentation["sections"][0]
    app.dependency_overrides[get_model] = lambda: TestModel(
        custom_output_text=json.dumps({"questions": ["a?", "b?", "c?", "d?"]})
    )
    try:
        client = TestClient(app)
        response = client.post(
            "/chat/suggestions", data={"text": input_text, "section": json.dumps(section)}
        )
        assert response.status_code == 200
        assert len(response.json()["questions"]) == 3  # generate_suggestions recorta a 3
    finally:
        app.dependency_overrides.clear()


def test_chat_stream_rehace_el_turno_sin_streaming_si_la_validacion_falla(
    input_text: str, monkeypatch
) -> None:
    """Un fallo de validación EN streaming no puede costar el turno.

    pydantic-ai lo dice literal: «Output validation failed during streaming, and retries are not
    supported in `run_stream()`». Cuando la salida del modelo no encaja con `ChatAnswer`, el
    camino normal es devolvérsela para que la corrija, y ese reintento no existe mientras se
    streamea. En producción eso salía como «La generación se interrumpió», con el turno perdido.

    Aquí se fuerza ese fallo y se comprueba lo que importa: que el turno termina igual, con su
    respuesta anclada, por el camino sin streaming, que sí reintenta.
    """
    from pydantic_ai.exceptions import UnexpectedModelBehavior

    from multimodal_presenter.pipeline import chat as modulo

    def revienta_al_streamear(*_args, **_kwargs):
        raise UnexpectedModelBehavior(
            "Output validation failed during streaming, and retries are not supported"
        )

    monkeypatch.setattr(modulo.chat_agent, "run_stream", revienta_al_streamear)

    model = TestModel(custom_output_args=_answer("La empresa vendió 150 en 2024.", quote=QUOTE_OK))
    ext = prepare_input(text=input_text)
    events = asyncio.run(_collect(chat_stream(model, extraction=ext, history=[], question="¿?")))

    assert events[-1].type == "done", "el turno tiene que terminar, no morirse"
    response = events[-1].response
    assert response.grounding == "verified"
    assert response.content.content_type == "text"
    # Sin streaming no hay efecto de escritura: el turno llega entero en el evento final.
    assert [e for e in events if e.type == "text"] == []
