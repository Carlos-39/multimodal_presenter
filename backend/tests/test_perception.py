"""Tests de la Fase 0 (percepción de audio) y del esquema `AudioEvidence`, con modelo mockeado.

Cubre la disciplina del esquema (conjuntos cerrados, span válido) y la guarda determinista
que descarta marcas de énfasis que el modelo no puede citar de su propia transcripción.
"""

import asyncio

import pytest
from pydantic import ValidationError
from pydantic_ai.models.test import TestModel

from multimodal_presenter.pipeline.perception import perceive_audio
from multimodal_presenter.schemas.audio import AudioEvidence, drop_unquoted_emphasis


def _evidence_args(
    *,
    text: str = "las ventas crecieron un veinte por ciento",
    emphasis: list[str] | None = None,
    speakers: int = 1,
) -> dict:
    """Argumentos de salida del modelo de percepción (lo que devolvería la tool)."""
    return {
        "segments": [
            {
                "speaker": "hablante 1",
                "text": text,
                "start_s": 0.0,
                "end_s": 4.5,
                "emphasis": emphasis if emphasis is not None else ["veinte por ciento"],
                "delivery": "enfatico",
                "pause_before": "ninguna",
                "confidence": "alta",
            }
        ],
        "non_verbal_events": [],
        "acoustic_context": {
            "quality": "clara",
            "background_noise": "",
            "intelligibility_risk": False,
            "at_risk_items": [],
        },
        "speaker_count": speakers,
        "perceived_structure": [],
        "language": "es",
    }


# ─────────────────────────────────────────────────────────────
# Esquema
# ─────────────────────────────────────────────────────────────
def test_evidence_valida_y_hace_roundtrip() -> None:
    evidence = AudioEvidence.model_validate(_evidence_args())
    assert evidence.speaker_count == 1
    assert evidence.segments[0].delivery == "enfatico"
    assert AudioEvidence.model_validate(evidence.model_dump()) == evidence


def test_delivery_fuera_del_conjunto_cerrado_es_rechazado() -> None:
    args = _evidence_args()
    args["segments"][0]["delivery"] = "entusiasmado"  # no está en el Literal
    with pytest.raises(ValidationError):
        AudioEvidence.model_validate(args)


def test_segmento_con_fin_antes_del_inicio_es_rechazado() -> None:
    args = _evidence_args()
    args["segments"][0]["end_s"] = 0.0
    args["segments"][0]["start_s"] = 3.0
    with pytest.raises(ValidationError):
        AudioEvidence.model_validate(args)


def test_evidencia_sin_segmentos_es_rechazada() -> None:
    args = _evidence_args()
    args["segments"] = []
    with pytest.raises(ValidationError):
        AudioEvidence.model_validate(args)


def test_campo_extra_es_rechazado() -> None:
    args = _evidence_args()
    args["sentimiento"] = "positivo"  # extra="forbid"
    with pytest.raises(ValidationError):
        AudioEvidence.model_validate(args)


def test_listas_vacias_son_respuesta_valida() -> None:
    """No oír énfasis ni eventos no verbales es un dato, no un hueco a rellenar."""
    evidence = AudioEvidence.model_validate(_evidence_args(emphasis=[]))
    assert evidence.segments[0].emphasis == []
    assert evidence.non_verbal_events == []


# ─────────────────────────────────────────────────────────────
# Localización de citas (localiza, NO verifica)
# ─────────────────────────────────────────────────────────────
def test_locate_devuelve_el_segundo_del_segmento_que_contiene_la_cita() -> None:
    evidence = AudioEvidence.model_validate(_evidence_args())
    assert evidence.locate("ventas crecieron") == 0.0


def test_locate_devuelve_none_si_la_cita_no_esta() -> None:
    evidence = AudioEvidence.model_validate(_evidence_args())
    assert evidence.locate("los costos bajaron") is None


# ─────────────────────────────────────────────────────────────
# Guarda determinista contra anotación alucinada
# ─────────────────────────────────────────────────────────────
def test_descarta_enfasis_que_no_esta_literal_en_el_segmento() -> None:
    evidence = AudioEvidence.model_validate(
        _evidence_args(emphasis=["veinte por ciento", "crecimiento histórico"])
    )
    saneada, dropped = drop_unquoted_emphasis(evidence)
    assert saneada.segments[0].emphasis == ["veinte por ciento"]
    assert dropped == ["crecimiento histórico"]


def test_no_toca_la_evidencia_si_todo_el_enfasis_es_literal() -> None:
    evidence = AudioEvidence.model_validate(_evidence_args())
    saneada, dropped = drop_unquoted_emphasis(evidence)
    assert dropped == []
    assert saneada is evidence


# ─────────────────────────────────────────────────────────────
# Agente de percepción (modelo mockeado)
# ─────────────────────────────────────────────────────────────
def test_perceive_audio_devuelve_evidencia_tipada() -> None:
    model = TestModel(custom_output_args=_evidence_args(speakers=2))
    evidence = asyncio.run(perceive_audio(b"fake-audio", "audio/mpeg", model))
    assert isinstance(evidence, AudioEvidence)
    assert evidence.speaker_count == 2
    assert evidence.language == "es"


def test_perceive_audio_sanea_el_enfasis_alucinado() -> None:
    model = TestModel(
        custom_output_args=_evidence_args(emphasis=["veinte por ciento", "nunca se dijo esto"])
    )
    evidence = asyncio.run(perceive_audio(b"fake-audio", "audio/wav", model))
    assert evidence.segments[0].emphasis == ["veinte por ciento"]
