"""Modelos INTERNOS del pipeline (no forman parte del contrato backend↔frontend)."""

from pydantic import BaseModel, ConfigDict, Field

from ..schemas import Presentation
from ..schemas.transform import (
    GroundingReport,
    SemanticCoherenceReport,
    SourceKind,
)


class Segment(BaseModel):
    """Un fragmento del documento de texto con sus offsets en el texto original."""

    model_config = ConfigDict(extra="forbid")

    index: int
    text: str
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)


class ExtractionResult(BaseModel):
    """Salida de la Fase 1. Representa la fuente ya validada y preparada para el modelo.

    - Fuente de texto: `text` tiene el documento y `segments` sus párrafos con offsets.
    - Fuente binaria (PDF/imagen): `binary` + `media_type` tienen el documento; `instruction`
      guarda la indicación opcional que el usuario escribió junto al archivo.
    """

    model_config = ConfigDict(extra="forbid")

    source_kind: SourceKind
    document_id: str

    # Fuente de texto
    text: str | None = None
    segments: list[Segment] = Field(default_factory=list)
    has_numbers: bool = False
    paragraph_count: int = 0

    # Fuente binaria
    binary: bytes | None = None
    media_type: str | None = None
    filename: str | None = None

    # Instrucción/contexto opcional que acompaña a un archivo (texto + archivo combinados).
    instruction: str | None = None


class PipelineResult(BaseModel):
    """Resultado interno del pipeline completo, antes de mapearlo al envelope de la API."""

    model_config = ConfigDict(extra="forbid")

    presentation: Presentation
    grounding: GroundingReport
    semantic: SemanticCoherenceReport
