"""Representación intermedia de un audio percibido — `AudioEvidence` (Fase 0).

El motor de estructuración (Claude Sonnet) NO admite audio como modalidad de entrada en su
API. Para no romper el principio rector (nunca aplanar la fuente antes de que un modelo la
interprete), el audio no se transcribe con un STT y se trata como texto: se delega la
percepción a un modelo con entrada acústica nativa, que produce ESTA representación
estructurada. Incluye, además del contenido verbal, hablantes, énfasis, pausas, eventos no
verbales y condiciones acústicas — información que una transcripción plana descarta.

**Este NO es parte del contrato público backend↔frontend.** Es una representación interna
entre la Fase 0 (percepción) y la Fase 2 (estructuración). Lo que llega al frontend sigue
siendo la `Presentation` del Hito 1; del audio solo viaja el `source_kind="audio"` y el
segundo aproximado de la cita (`SectionGrounding.start_s`).

Disciplina de tipos: igual que el contrato del Hito 1, los rasgos categóricos son
**conjuntos cerrados** (`Literal`), no texto libre — un `delivery` como string abierto
dejaría al análisis posterior comparando sinónimos del modelo.

Honestidad: `confidence` existe para que el anotador pueda declarar duda en vez de
adivinar; el prompt de la Fase 0 pide explícitamente bajarla ante la incertidumbre. Las
listas vacías son respuestas válidas (no oír énfasis es un dato, no un hueco a rellenar).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ─────────────────────────────────────────────────────────────
# Enums — conjuntos cerrados (misma disciplina del Hito 1)
# ─────────────────────────────────────────────────────────────
Confidence = Literal["alta", "media", "baja"]
"""Confianza del anotador en lo que afirma. `baja` es una respuesta legítima y esperada."""

Delivery = Literal["seguro", "neutro", "dubitativo", "enfatico"]
"""Cómo se dijo el segmento. `dubitativo` es la señal que matiza cifras en la Fase 2."""

PauseBefore = Literal["ninguna", "breve", "larga"]
"""Pausa audible antes del segmento. Tres valores en vez de `bool | "larga"`: el proyecto
no tiene uniones blandas de este tipo y el análisis necesita distinguir breve de larga."""

NonVerbalKind = Literal[
    "risa", "suspiro", "carraspeo", "musica", "ruido", "aplausos", "silencio", "otro"
]

AudioQuality = Literal["clara", "aceptable", "pobre"]


# ─────────────────────────────────────────────────────────────
# Piezas de la anotación
# ─────────────────────────────────────────────────────────────
class AudioSegment(_Strict):
    """Un tramo de habla con sus rasgos paralingüísticos observables."""

    speaker: str = Field(min_length=1)
    """Etiqueta estable DENTRO de este audio ("hablante 1"), no identidad de una persona
    real: el prompt prohíbe explícitamente intentar identificar a alguien."""

    text: str = Field(min_length=1)
    """Lo dicho, tal como suena (titubeos y frases a medias incluidos, sin "mejorar")."""

    start_s: float = Field(ge=0)
    end_s: float = Field(ge=0)

    emphasis: list[str] = Field(default_factory=list)
    """Frases con énfasis AUDIBLE. Deben ser substrings literales de `text`, lo que permite
    verificarlas en código (`drop_unquoted_emphasis`) en vez de solo confiar en el prompt."""

    delivery: Delivery
    pause_before: PauseBefore
    confidence: Confidence

    @model_validator(mode="after")
    def _check_span(self) -> AudioSegment:
        if self.end_s < self.start_s:
            raise ValueError("end_s no puede ser menor que start_s")
        return self


class NonVerbalEvent(_Strict):
    """Un evento no verbal oído en la señal (risa, suspiro, música, ruido…)."""

    kind: NonVerbalKind
    description: str
    at_s: float = Field(ge=0)
    confidence: Confidence


class AcousticContext(_Strict):
    """Condiciones de la grabación y su efecto en la inteligibilidad."""

    quality: AudioQuality
    background_noise: str = ""
    """Descripción del ruido de fondo; cadena vacía si no hay."""

    intelligibility_risk: bool = False
    """True si la calidad o el ruido pudieron afectar la lectura de cifras o nombres."""

    at_risk_items: list[str] = Field(default_factory=list)
    """Las cifras, nombres propios o siglas concretos que quedaron dudosos POR EL AUDIO.
    La Fase 2 los matiza explícitamente en vez de presentarlos como dato firme."""


class TopicShift(_Strict):
    """Cambio de tema marcado por la PROSODIA (no por interpretación del contenido)."""

    at_s: float = Field(ge=0)
    cue: str
    """Qué rasgo lo marca: pausa larga, cambio de tono, cambio de ritmo."""

    label: str
    """A qué tema se pasa."""


class AudioEvidence(_Strict):
    """Salida de la Fase 0: lo que un modelo con entrada acústica oyó en el archivo."""

    segments: list[AudioSegment] = Field(min_length=1)
    non_verbal_events: list[NonVerbalEvent] = Field(default_factory=list)
    acoustic_context: AcousticContext
    speaker_count: int = Field(ge=1)
    perceived_structure: list[TopicShift] = Field(default_factory=list)

    language: str = Field(min_length=1)
    """Idioma hablado. Sin este campo la Fase 2 perdería la regla "redacta en el idioma del
    documento", que con texto infiere de la fuente y aquí ya no puede."""

    @property
    def verbal_text(self) -> str:
        """Contenido verbal concatenado. SOLO para localizar citas y como línea base de la
        mini-evaluación: no se usa como documento para el grounding (ver `ground_section`)."""
        return "\n".join(segment.text for segment in self.segments)

    def locate(self, quote: str) -> float | None:
        """Segundo aproximado del segmento que contiene `quote`, o None.

        **Localiza, no verifica.** El estado de grounding del audio sigue siendo
        `unverified`: la cita se busca contra la transcripción del modelo de percepción —
        un derivado aplanado de la señal— no contra el audio. Sirve para que el reproductor
        salte al momento, igual que `page` lleva a la página en PDF.
        """
        for segment in self.segments:
            if quote in segment.text:
                return segment.start_s
        return None


def drop_unquoted_emphasis(evidence: AudioEvidence) -> tuple[AudioEvidence, list[str]]:
    """Descarta las frases de `emphasis` que no aparecen literalmente en su segmento.

    Guarda determinista contra anotación alucinada: si el modelo "recuerda" un énfasis que
    no puede citar de su propia transcripción, la marca no es observable y se cae. Devuelve
    la evidencia saneada y la lista de frases descartadas (para trazarlas, no para ocultarlas).
    """
    dropped: list[str] = []
    segments: list[AudioSegment] = []
    for segment in evidence.segments:
        kept = [phrase for phrase in segment.emphasis if phrase in segment.text]
        dropped.extend(phrase for phrase in segment.emphasis if phrase not in segment.text)
        segments.append(segment.model_copy(update={"emphasis": kept}))
    if not dropped:
        return evidence, []
    return evidence.model_copy(update={"segments": segments}), dropped
