"""Contrato público de la transformación — frontera backend↔frontend.

Mantiene la disciplina tipada del Hito 1: la respuesta es un envelope Pydantic
`{presentation, grounding}`, no un dict suelto. El estado de grounding viaja en el CUERPO
(no solo en Logfire) porque el frontend lo necesita para la atribución de fuentes
interactiva (Punto 4) y el anclaje del chat (Hito 6).

Hito 4: el grounding distingue tres estados honestos según la fuente:
- `verified`   → texto: la cita se encontró en el documento (offsets calculados).
- `not_found`  → texto: se verificó y la cita NO está (warning real de fabricación).
- `unverified` → PDF/imagen: no se puede verificar por substring sin aplanar el binario
  (contra el principio rector); queda pendiente la verificación por página/región (Hito 5).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .presentation import Presentation, Section


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


GroundingStatus = Literal["verified", "unverified", "not_found"]
SourceKind = Literal["text", "pdf", "image"]


class SectionGrounding(_Strict):
    """Estado de anclaje a fuente de una sección."""

    section_id: str
    status: GroundingStatus
    char_start: int | None = Field(default=None, ge=0)  # solo fuentes de texto
    char_end: int | None = Field(default=None, ge=0)
    page: int | None = Field(default=None, ge=1)  # solo PDF


class GroundingReport(_Strict):
    """Resultado de la verificación de grounding (Fase 3, nivel barato/determinista)."""

    source_kind: SourceKind
    sections: list[SectionGrounding]
    total_sections: int = Field(ge=0)
    verified_sections: int = Field(ge=0)
    unverified_sections: int = Field(ge=0)  # PDF/imagen: pendiente de verificación (Hito 5)
    not_found_sections: int = Field(ge=0)  # texto: cita no anclable al documento

    # Hito 8: el grounding se endureció. (1) Matching robusto (canonicalización de puntuación)
    # reduce los `not_found` falsos → más contenido trazable. (2) El `not_found` verdadero ya NO
    # es un warning blando: el frontend lo pone en AVISO visible y le quita el botón de fuente
    # (no se finge una cita que no ancla), coherente con el chat. No se descarta la sección
    # (dejaría el contenido incompleto): se avisa con honestidad.
    # TODO(Hito5): verificación por página/región para PDF/imagen (hoy `unverified`); el
    # aplanamiento/render por página que viene en paralelo hará trazable más contenido binario.


class SemanticObservation(_Strict):
    section_id: str
    issue: str


class SemanticCoherenceReport(_Strict):
    """Coherencia semántica contenido↔fuente (Fase 3, nivel LLM).

    Interfaz real ya cableada por el pipeline; hoy no-op. TODO(Hito2.1): implementar.
    """

    observations: list[SemanticObservation] = Field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.observations


class ChartNote(_Strict):
    """Nota determinista sobre un gráfico tras la regla de isomorfismo (Hito 5a).

    - `corrected`: el tipo se corrigió a uno admisible según la forma de los datos.
    - `degraded`: no había gráfico válido; la sección se muestra como tabla.
    """

    section_id: str
    kind: Literal["corrected", "degraded"]
    detail: str


class TransformResponse(_Strict):
    """Envelope de respuesta del endpoint /transform (no-streaming)."""

    presentation: Presentation
    grounding: GroundingReport
    semantic: SemanticCoherenceReport
    chart_notes: list[ChartNote] = Field(default_factory=list)


class SummaryResponse(_Strict):
    """Adelanto inicial del contenido (Hito 5g), separado de la presentación completa."""

    summary: str


class NarrationRequest(_Strict):
    """Petición de narración (Hito 5g Parte 3): la presentación ya generada (sus núcleos).

    No modifica el contrato: solo transporta una `Presentation` existente al endpoint de audio.
    """

    presentation: Presentation


class ImageExplanationResponse(_Strict):
    """Explicación bajo demanda de una imagen real del documento (Hito 5h Parte 3)."""

    explanation: str


# --- Eventos SSE del endpoint /transform/stream (Hito 5d) ---
# Cada `Section` streameada es indistinguible en forma de una del contrato no-streaming.


class StreamStart(_Strict):
    type: Literal["start"] = "start"
    title: str


class StreamSection(_Strict):
    type: Literal["section"] = "section"
    section: Section
    grounding: SectionGrounding  # entrada por sección (para 5c en vivo)
    chart_note: ChartNote | None = None


class StreamDone(_Strict):
    type: Literal["done"] = "done"
    grounding: GroundingReport  # agregado holístico
    semantic: SemanticCoherenceReport
    chart_notes: list[ChartNote] = Field(default_factory=list)


class StreamError(_Strict):
    type: Literal["error"] = "error"
    message: str
