"""Modelos INTERNOS del pipeline (no forman parte del contrato backend↔frontend).

El contrato público (Presentation, y el envelope de respuesta TransformResponse) vive en
`schemas/`. Aquí van las estructuras de trabajo entre fases.
"""

from pydantic import BaseModel, ConfigDict, Field

from ..schemas import Presentation
from ..schemas.transform import GroundingReport, SemanticCoherenceReport


class Segment(BaseModel):
    """Un fragmento del documento (párrafo) con sus offsets en el texto original."""

    model_config = ConfigDict(extra="forbid")

    index: int
    text: str
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)


class ExtractionResult(BaseModel):
    """Salida de la Fase 1 (extracción determinista). Insumo para la Fase 2."""

    model_config = ConfigDict(extra="forbid")

    document_id: str
    text: str  # texto original SIN alterar (los offsets de grounding dependen de esto)
    segments: list[Segment]
    # Señales de forma de los datos — presentes pero sin decidir nada aún.
    # TODO(Hito5): detección real de forma que alimente el filtro de isomorfismo de gráficos.
    has_numbers: bool
    paragraph_count: int


class PipelineResult(BaseModel):
    """Resultado interno del pipeline completo, antes de mapearlo al envelope de la API."""

    model_config = ConfigDict(extra="forbid")

    presentation: Presentation
    grounding: GroundingReport
    semantic: SemanticCoherenceReport
