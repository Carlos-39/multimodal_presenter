"""Tests del enrutamiento de audio: Fase 0 → pipeline existente, grounding y endpoints.

Dos modelos mockeados distintos por prueba: el de percepción (ToolOutput → AudioEvidence) y
el de estructuración (PromptedOutput → JSON de la Presentation). Así se verifica que el audio
NO llega al motor de estructuración y que lo que llega es la evidencia.
"""

import asyncio
import json

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model, get_perception_model
from multimodal_presenter.main import app
from multimodal_presenter.pipeline import transform
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.streaming import transform_stream
from multimodal_presenter.pipeline.structuring import build_model_input
from multimodal_presenter.pipeline.validation import ground_section
from multimodal_presenter.schemas.audio import AudioEvidence
from multimodal_presenter.schemas.presentation import Section
from multimodal_presenter.schemas.transform import TransformResponse

QUOTE = "las ventas subieron un veinte por ciento"
DUDA = "fueron, eh, no sé, unos ochocientos mil"

_EVIDENCE = {
    "segments": [
        {
            "speaker": "hablante 1",
            "text": QUOTE,
            "start_s": 1.5,
            "end_s": 5.0,
            "emphasis": ["veinte por ciento"],
            "delivery": "enfatico",
            "pause_before": "ninguna",
            "confidence": "alta",
        },
        {
            "speaker": "hablante 2",
            "text": DUDA,
            "start_s": 5.0,
            "end_s": 9.0,
            "emphasis": [],
            "delivery": "dubitativo",
            "pause_before": "larga",
            "confidence": "baja",
        },
    ],
    "non_verbal_events": [
        {"kind": "ruido", "description": "tráfico de fondo", "at_s": 6.0, "confidence": "media"}
    ],
    "acoustic_context": {
        "quality": "aceptable",
        "background_noise": "tráfico",
        "intelligibility_risk": True,
        "at_risk_items": ["ochocientos mil"],
    },
    "speaker_count": 2,
    "perceived_structure": [{"at_s": 5.0, "cue": "pausa larga", "label": "cifras de ventas"}],
    "language": "es",
}

# Presentación cuyo quote SÍ aparece en un segmento de la evidencia (caso anclable).
_PRESENTATION = {
    "title": "Reporte hablado de ventas",
    "sections": [
        {
            "id": "a1",
            "role": "core",
            "source": {"document_id": "sin-verificar", "quote": QUOTE},
            "content": {"content_type": "text", "text": "Las ventas crecieron un 20%."},
        }
    ],
}


def _evidence() -> AudioEvidence:
    return AudioEvidence.model_validate(_EVIDENCE)


def _perception_model() -> TestModel:
    """Mock de la Fase 0: salida por tool (ToolOutput)."""
    return TestModel(custom_output_args=_EVIDENCE)


def _structuring_model(presentation: dict = _PRESENTATION) -> TestModel:
    """Mock de la Fase 2: salida por texto (PromptedOutput), como el agente real."""
    return TestModel(custom_output_text=json.dumps(presentation))


# ─────────────────────────────────────────────────────────────
# Fase 1: el audio queda identificado y exige la evidencia
# ─────────────────────────────────────────────────────────────
def test_prepare_input_marca_la_fuente_como_audio(wav_bytes: bytes) -> None:
    extraction = prepare_input(binary=wav_bytes, media_type="audio/wav", audio_evidence=_evidence())
    assert extraction.source_kind == "audio"
    assert extraction.audio_evidence is not None
    # El binario se conserva: sigue siendo la fuente real a la que apunta la atribución.
    assert extraction.binary == wav_bytes


def test_prepare_input_rechaza_audio_sin_evidencia(wav_bytes: bytes) -> None:
    """Sin Fase 0 no hay nada que pasarle a la estructuración (Sonnet no oye)."""
    with pytest.raises(ValueError, match="audio_evidence"):
        prepare_input(binary=wav_bytes, media_type="audio/wav")


# ─────────────────────────────────────────────────────────────
# Fase 2: lo que entra NO es el audio, es la evidencia
# ─────────────────────────────────────────────────────────────
def test_el_audio_no_llega_al_motor_de_estructuracion(wav_bytes: bytes) -> None:
    extraction = prepare_input(binary=wav_bytes, media_type="audio/wav", audio_evidence=_evidence())
    model_input = build_model_input(extraction)

    # Es un prompt de texto, no una lista con BinaryContent (como sí ocurre con PDF/imagen).
    assert isinstance(model_input, str)
    assert "EVIDENCIA ACÚSTICA" in model_input
    # Y lleva las instrucciones de uso del énfasis y de la duda.
    assert "REMARCÓ" in model_input
    assert "dubitativo" in model_input
    assert "ATRIBUYE cada idea a su hablante" in model_input
    # Los rasgos percibidos viajan serializados.
    assert "ochocientos mil" in model_input
    assert "tráfico" in model_input


def test_la_instruccion_del_usuario_acompana_al_audio(wav_bytes: bytes) -> None:
    extraction = prepare_input(
        text="enfócate en las cifras",
        binary=wav_bytes,
        media_type="audio/wav",
        audio_evidence=_evidence(),
    )
    assert "enfócate en las cifras" in build_model_input(extraction)


# ─────────────────────────────────────────────────────────────
# Fase 3: grounding de audio — unverified + momento (localiza, no verifica)
# ─────────────────────────────────────────────────────────────
def _section(quote: str) -> Section:
    return Section.model_validate(
        {
            "id": "a1",
            "role": "core",
            "source": {"document_id": "d", "quote": quote},
            "content": {"content_type": "text", "text": "x"},
        }
    )


def test_grounding_de_audio_es_unverified_con_el_momento(wav_bytes: bytes) -> None:
    extraction = prepare_input(binary=wav_bytes, media_type="audio/wav", audio_evidence=_evidence())
    _section_out, entry = ground_section(_section(QUOTE), extraction)
    # unverified, NO verified: la cita se halló en la transcripción de la Fase 0, que es un
    # derivado aplanado de la señal — encontrarla ahí no la verifica contra el audio.
    assert entry.status == "unverified"
    assert entry.start_s == 1.5
    # Y no se inventan offsets de texto ni páginas, que el audio no tiene.
    assert entry.char_start is None and entry.char_end is None
    assert entry.page is None


def test_grounding_de_audio_sin_momento_si_la_cita_no_esta(wav_bytes: bytes) -> None:
    extraction = prepare_input(binary=wav_bytes, media_type="audio/wav", audio_evidence=_evidence())
    _section_out, entry = ground_section(_section("esto nunca se dijo"), extraction)
    # Sigue `unverified` (el estado honesto de la fuente), simplemente sin momento al que ir.
    assert entry.status == "unverified"
    assert entry.start_s is None


# ─────────────────────────────────────────────────────────────
# Pipeline completo y streaming
# ─────────────────────────────────────────────────────────────
def test_pipeline_completo_con_audio(wav_bytes: bytes) -> None:
    result = asyncio.run(
        transform(
            _structuring_model(),
            binary=wav_bytes,
            media_type="audio/wav",
            semantic_enabled=False,
            perception_model=_perception_model(),
        )
    )
    assert result.grounding.source_kind == "audio"
    assert result.grounding.unverified_sections == 1
    assert result.grounding.sections[0].start_s == 1.5


def test_streaming_con_audio_emite_las_secciones_igual(wav_bytes: bytes) -> None:
    async def run() -> list:
        return [
            event
            async for event in transform_stream(
                _structuring_model(),
                binary=wav_bytes,
                media_type="audio/wav",
                semantic_enabled=False,
                perception_model=_perception_model(),
            )
        ]

    events = asyncio.run(run())
    types = [event.type for event in events]
    assert types[0] == "start" and types[-1] == "done"
    assert "section" in types
    section_event = next(e for e in events if e.type == "section")
    assert section_event.grounding.status == "unverified"
    assert section_event.grounding.start_s == 1.5


def test_la_percepcion_no_se_ejecuta_para_texto(input_text: str, mock_presentation: dict) -> None:
    """La Fase 0 es aislada: con texto no se toca, ni aunque se pase un modelo de percepción.

    Si se ejecutara, el TestModel de percepción devolvería un AudioEvidence donde el pipeline
    espera otra cosa y la prueba fallaría.
    """
    result = asyncio.run(
        transform(
            _structuring_model(mock_presentation),
            text=input_text,
            semantic_enabled=False,
            perception_model=_perception_model(),
        )
    )
    assert result.grounding.source_kind == "text"
    assert result.grounding.verified_sections == 2


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────
@pytest.fixture
def client():
    app.dependency_overrides[get_model] = _structuring_model
    app.dependency_overrides[get_perception_model] = _perception_model
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def client_sin_percepcion():
    """Cliente sin proveedor de audio configurado (el caso de no tener clave de Gemini)."""
    app.dependency_overrides[get_model] = _structuring_model
    app.dependency_overrides[get_perception_model] = lambda: None
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def test_transform_acepta_un_audio(client, wav_bytes: bytes) -> None:
    response = client.post("/transform", files={"file": ("clip.wav", wav_bytes, "audio/wav")})
    assert response.status_code == 200
    body = response.json()
    assert body["grounding"]["source_kind"] == "audio"
    assert body["grounding"]["sections"][0]["start_s"] == 1.5
    TransformResponse.model_validate(body)


def test_audio_sin_proveedor_de_percepcion_da_503_claro(
    client_sin_percepcion, wav_bytes: bytes
) -> None:
    response = client_sin_percepcion.post(
        "/transform", files={"file": ("clip.wav", wav_bytes, "audio/wav")}
    )
    assert response.status_code == 503
    assert "GOOGLE_API_KEY" in response.json()["detail"]


def test_texto_sigue_funcionando_sin_proveedor_de_audio(
    client_sin_percepcion, input_text: str
) -> None:
    """Sin clave de Gemini, el resto del sistema funciona exactamente igual que antes."""
    response = client_sin_percepcion.post("/transform", data={"text": input_text})
    assert response.status_code == 200
    assert response.json()["grounding"]["source_kind"] == "text"


def test_audio_demasiado_largo_da_413_antes_de_llamar_al_modelo(client) -> None:
    from .conftest import make_wav

    # 16 min supera el tope de 15 min por defecto. Frecuencia baja a propósito: lo que se
    # prueba es la DURACIÓN, así que no hace falta generar 15 MB de silencio.
    largo = make_wav(seconds=16 * 60, rate=800)
    response = client.post("/transform", files={"file": ("largo.wav", largo, "audio/wav")})
    assert response.status_code == 413
    assert "límite" in response.json()["detail"]


@pytest.mark.parametrize(
    ("ruta", "campos"),
    [
        ("/summary", {}),
        ("/deck", {}),
        ("/chat/stream", {"question": "¿cuánto subieron las ventas?"}),
        ("/chat/suggestions", {"section": "{}"}),
    ],
)
def test_las_funciones_derivadas_rechazan_audio_con_mensaje_visible(
    client, wav_bytes: bytes, ruta: str, campos: dict
) -> None:
    """Releen la fuente y la pasarían a Sonnet, que no oye: 415 explícito, no error opaco."""
    response = client.post(ruta, data=campos, files={"file": ("clip.wav", wav_bytes, "audio/wav")})
    assert response.status_code == 415
    assert "audio" in response.json()["detail"]


def test_explain_image_rechaza_audio(client, wav_bytes: bytes) -> None:
    response = client.post("/explain-image", files={"file": ("clip.wav", wav_bytes, "audio/wav")})
    assert response.status_code == 400
    assert "imagen" in response.json()["detail"]
