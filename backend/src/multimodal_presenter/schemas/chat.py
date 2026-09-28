"""Contrato del chat anclado a fuentes (Hito 6).

Reusa las piezas del contrato de la transformación, NO inventa un esquema paralelo:
- la respuesta del chat es un `SectionContent` (la MISMA discriminated union del Hito 1:
  texto/tabla/timeline/gráfico) → se renderiza con la misma Generative UI;
- el anclaje es un `SourceReference` + un `GroundingStatus`, idénticos a los del 5c.

No es una `Section` de la presentación (no tiene rol núcleo/satélite ni entra en la
`Presentation`): es una respuesta conversacional. Por eso vive aquí y no toca
`schemas/presentation.py`.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .presentation import SectionContent, SourceReference
from .transform import GroundingStatus


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatTurn(_Strict):
    """Un turno del historial (vive en el estado del frontend; el backend no lo persiste)."""

    role: Literal["user", "assistant"]
    text: str


class ChatAnswer(_Strict):
    """Salida CRUDA del LLM (vía PromptedOutput). El código la postprocesa a `ChatResponse`.

    El LLM aporta el `content` y una CITA verbatim (`source_quote`) que respalda la respuesta;
    NO calcula offsets (eso es determinista, en código). Si no puede responder/anclar desde el
    documento, deja `source_quote` en null (estado honesto "no anclable").
    """

    content: SectionContent
    source_quote: str | None = Field(
        default=None,
        description="Fragmento textual EXACTO del documento que respalda la respuesta; "
        "null si no se puede anclar.",
    )
    source_page: int | None = Field(
        default=None, ge=1, description="Página del PDF fuente, si aplica."
    )


class ChatResponse(_Strict):
    """Respuesta pública del chat: contenido renderizable + anclaje verificado por código."""

    content: SectionContent
    source: SourceReference | None  # None = no se pudo anclar (no se inventa una fuente falsa)
    grounding: GroundingStatus  # verified | unverified (PDF) | not_found (no anclado)


class SuggestionsResponse(_Strict):
    """Preguntas sugeridas específicas a una sección (Punto 9). Invitación, no obligación."""

    questions: list[str] = Field(default_factory=list)


# ── Eventos SSE de POST /chat/stream ──
# El texto se emite en vivo (efecto de escritura); el ancla y los componentes interactivos
# se muestran al FINAL, ya completos y validados (honesto: nunca una respuesta a medias que
# parezca final).


class ChatStreamText(_Strict):
    type: Literal["text"] = "text"
    text: str  # texto acumulado hasta ahora (el frontend reemplaza lo mostrado)


class ChatStreamDone(_Strict):
    type: Literal["done"] = "done"
    response: ChatResponse


class ChatStreamError(_Strict):
    type: Literal["error"] = "error"
    message: str
