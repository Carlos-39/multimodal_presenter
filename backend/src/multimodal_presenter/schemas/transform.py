"""Contrato público de la transformación (Hito 2) — frontera backend↔frontend.

Mantiene la disciplina tipada del Hito 1: la respuesta NO es un dict suelto, es un
envelope Pydantic `{presentation, grounding}`. El estado de grounding viaja en el CUERPO
(no solo en Logfire) porque el frontend lo necesitará para la atribución de fuentes
interactiva (Punto 4) y el anclaje del chat (Punto transversal), no solo el desarrollador.
"""

from pydantic import BaseModel, ConfigDict, Field

from .presentation import Presentation


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TransformRequest(_Strict):
    """Entrada del endpoint: por ahora texto plano (PDF/imagen es Hito 4)."""

    text: str = Field(min_length=1)


class SectionGrounding(_Strict):
    """Estado de anclaje a fuente de una sección, verificado deterministamente."""

    section_id: str
    grounded: bool  # ¿el `quote` existe realmente en el documento fuente?
    char_start: int | None = Field(default=None, ge=0)
    char_end: int | None = Field(default=None, ge=0)


class GroundingReport(_Strict):
    """Resultado de la verificación de grounding (Fase 3, nivel barato/determinista)."""

    sections: list[SectionGrounding]
    total_sections: int = Field(ge=0)
    grounded_sections: int = Field(ge=0)
    ungrounded_sections: int = Field(ge=0)  # = nº de warnings de grounding

    # TODO(Hito8): el grounding NO puede quedarse en warning para la evaluación con
    # usuarios. La trazabilidad de fuentes es la propuesta de valor no-negociable del
    # proyecto; devolver afirmaciones sin anclaje verificado contradice esa propuesta.
    # Endurecer (¿rechazar?, ¿reintentar?) antes del Hito 8.


class SemanticObservation(_Strict):
    """Una observación de incoherencia semántica entre el contenido y la fuente."""

    section_id: str
    issue: str


class SemanticCoherenceReport(_Strict):
    """Resultado de la verificación de coherencia semántica (Fase 3, nivel LLM).

    Interfaz REAL, no un comentario: el pipeline ya la llama y consume su resultado. Hoy
    es un no-op que retorna "sin observaciones"; el cuerpo se implementa en el Hito 2.1.
    """

    observations: list[SemanticObservation] = Field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.observations


class TransformResponse(_Strict):
    """Envelope de respuesta del endpoint /transform."""

    presentation: Presentation
    grounding: GroundingReport
