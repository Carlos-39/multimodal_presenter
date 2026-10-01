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


class ClarificationNeeded(_Strict):
    """Cognitive Forcing Function (opción D, Fase 2): pedido de aclaración ante ambigüedad real.

    Es una INVITACIÓN de cortesía, nunca un obstáculo (coherente con el Punto 9: sin checkpoints
    bloqueantes). Se pide a lo sumo una vez por ambigüedad; si está presente, la respuesta NO es
    una respuesta anclada sino una pregunta breve con 1-2 interpretaciones clicables opcionales.
    """

    question: str = Field(
        min_length=1, description="La aclaración breve, estilo cortesía (1 frase)."
    )
    options: list[str] = Field(
        default_factory=list,
        max_length=3,
        description="1-2 interpretaciones concretas para clicar; opcional (el usuario puede "
        "reescribir en vez de elegir).",
    )


class ChatAnswer(_Strict):
    """Salida CRUDA del LLM (vía PromptedOutput). El código la postprocesa a `ChatResponse`.

    El LLM aporta el `content` y una CITA verbatim (`source_quote`) que respalda la respuesta;
    NO calcula offsets (eso es determinista, en código). Si no puede responder/anclar desde el
    documento, deja `source_quote` en null (estado honesto "no anclable"). Si la pregunta es
    genuinamente ambigua, llena `clarification` en vez de adivinar (opción D).
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
    clarification: ClarificationNeeded | None = Field(
        default=None,
        description="Si la pregunta es genuinamente ambigua, el pedido de aclaración; null si "
        "se puede responder (por defecto se responde).",
    )


class ChatResponse(_Strict):
    """Respuesta pública del chat: contenido renderizable + anclaje verificado por código.

    Si `clarification` está presente, este turno es un pedido de aclaración (opción D), no una
    respuesta: el frontend lo muestra con estado visual propio y `source`/`grounding` no aplican.
    """

    content: SectionContent
    source: SourceReference | None  # None = no se pudo anclar (no se inventa una fuente falsa)
    grounding: GroundingStatus  # verified | unverified (PDF) | not_found (no anclado)
    clarification: ClarificationNeeded | None = None  # presente = pide aclaración, no responde


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
