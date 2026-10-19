"""Contrato público de la transformación, frontera backend↔frontend.

Mantiene la disciplina tipada del Hito 1: la respuesta es un envelope Pydantic
`{presentation, grounding}`, no un dict suelto. El estado de grounding viaja en el CUERPO
(no solo en Logfire) porque el frontend lo necesita para la atribución de fuentes
interactiva (Punto 4) y el anclaje del chat (Hito 6).

Hito 4: el grounding distingue tres estados honestos según la fuente:
- `verified`   → texto: la cita se encontró en el documento (offsets calculados).
- `not_found`  → texto: se verificó y la cita NO está (warning real de fabricación).
- `unverified` → PDF/imagen/audio: no se puede verificar por substring sin aplanar la fuente
  (contra el principio rector); queda pendiente la verificación por página/región (Hito 5).

Audio (A1): el estado honesto es `unverified`, el MISMO de PDF/imagen, y a propósito no se
añade un cuarto estado. La cita de una sección generada desde audio proviene de la
transcripción que hizo el modelo de percepción (Fase 0) ( un derivado aplanado de la señal ),
así que encontrarla ahí no verifica nada contra el audio: sería verificar contra el derivado y
presentarlo como verificación de la fuente, justo la sobre-afirmación que eliminó el Hito 8A.1.
Lo que sí se aporta es `SectionGrounding.start_s`, el análogo de `page`: lleva al momento del
audio, sin afirmar que el contenido quedó verificado.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from .presentation import (
    ChartContent,
    GeneratedIllustration,
    Presentation,
    Section,
    SourceReference,
    TableContent,
    TimelineContent,
)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


GroundingStatus = Literal["verified", "unverified", "not_found"]
SourceKind = Literal["text", "pdf", "image", "audio"]


class RegionBox(_Strict):
    """Un recuadro dentro de la página, en fracciones 0-1 con origen arriba-izquierda.

    En fracciones y no en píxeles a propósito: el frontend solo multiplica por el tamaño de su
    contenedor y posiciona en porcentaje. Nunca calcula escalas ni aplica rotaciones, eso ya se
    resolvió en el backend, con el mismo motor que dibuja la página, así que el recuadro no puede
    descuadrarse respecto a lo que se ve.
    """

    x0: float = Field(ge=0, le=1)
    y0: float = Field(ge=0, le=1)
    x1: float = Field(ge=0, le=1)
    y1: float = Field(ge=0, le=1)


class CitedRegion(_Strict):
    """Dónde está la cita DENTRO de la página citada. Un recuadro por renglón.

    Sube el PDF de fidelidad de PÁGINA (5c: "te llevo a la página 7") a fidelidad de REGIÓN. Es
    el cuarto nivel del mismo esquema honesto que ya usan el texto (offsets exactos) y el audio
    (momento, A1).

    **No existe el valor "página" aquí**, y es deliberado: la fidelidad de página es la AUSENCIA
    del campo (`region = None`). Así el estado contradictorio ("solo sé la página" pero con
    recuadros dentro) no se puede ni representar, y un cliente que ignore el campo se comporta
    exactamente como antes de que existiera.

    **Localizar no es verificar** (mismo criterio que `start_s` en audio): encontrar la cita en la
    capa de texto NO cambia `GroundingStatus`, que sigue siendo `unverified` para PDF. Lo que se
    gana es poder señalar dónde mirar, no una afirmación de que el contenido quedó verificado.
    """

    page: int = Field(ge=1)
    """Página en la que están los recuadros. Viaja CON ellos, y no se da por supuesto que sea
    `SectionGrounding.page`: si la cita no estaba en la página que dijo el modelo pero sí en una
    vecina, los recuadros son de esa otra. Juntos, dibujarlos sobre la página equivocada deja de
    ser un estado representable."""

    quality: Literal["exact", "approximate"]
    """`exact`: la cita está literal (salvo variantes tipográficas y de espaciado).
    `approximate`: se halló un pasaje muy parecido; el recuadro señala una zona, no la frase. La
    UI debe decirlo: marcar como exacto algo aproximado sería la sobre-afirmación del 8A.1."""

    boxes: list[RegionBox] = Field(min_length=1)


class SectionGrounding(_Strict):
    """Estado de anclaje a fuente de una sección."""

    section_id: str
    status: GroundingStatus
    char_start: int | None = Field(default=None, ge=0)  # solo fuentes de texto
    char_end: int | None = Field(default=None, ge=0)
    page: int | None = Field(default=None, ge=1)  # solo PDF
    start_s: float | None = Field(default=None, ge=0)  # solo audio: segundo aproximado
    """Momento del audio del que viene la cita, para que el reproductor salte ahí, el
    análogo exacto de `page` en PDF. Se obtiene LOCALIZANDO la cita en la transcripción de la
    Fase 0, no verificándola contra la señal: el estado sigue siendo `unverified`."""

    region: CitedRegion | None = None
    """Solo PDF con capa de texto: dónde está la cita dentro de `page`. `None` = fidelidad de
    página, el comportamiento de siempre. Hermano de `start_s`, no parte de `SourceReference`."""


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
    # TODO(Hito5): VERIFICACIÓN por página/región para PDF/imagen (hoy `unverified`). Ojo con la
    # distinción: la localización por región ya existe (ver `CitedRegion`), pero localizar no es
    # verificar: el estado no cambia por encontrar la cita en la capa de texto. Lo que sigue
    # abierto es poder afirmar que el contenido quedó verificado contra la fuente binaria.


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
    transcript: str | None = None
    """Solo fuentes de audio: lo que la Fase 0 oyó. `None` para texto, PDF e imagen, que no
    pasan por la percepción. Ver `StreamTranscript` para el razonamiento."""

    audio_evidence: str | None = None
    """Solo audio: la `AudioEvidence` serializada, para que las funciones derivadas relean el
    mismo documento (ver `StreamTranscript.evidence`)."""


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


class TranscriptionResponse(_Strict):
    """Texto transcrito de una pregunta hablada al chat (entrada por voz)."""

    text: str


class IllustrationsRequest(_Strict):
    """Petición de ilustraciones de apoyo (Hito 5h Parte 1): la presentación ya generada."""

    presentation: Presentation


class IllustrationItem(_Strict):
    """Una ilustración generada, atada a su sección por id."""

    section_id: str
    illustration: GeneratedIllustration


class IllustrationsResponse(_Strict):
    """Ilustraciones generadas para las secciones que calificaron (puede ser vacía)."""

    illustrations: list[IllustrationItem] = Field(default_factory=list)


PapelDeSlide = Literal["apertura", "afirmacion", "dato", "comparacion", "cita", "figura", "cierre"]
"""Qué hace una diapositiva, y por tanto qué forma tiene.

Antes no existía: una diapositiva traía título, cuerpo, viñetas e imagen, y la composición se
deducía de cuál de esos campos venía lleno. Con ese vocabulario solo podía salir una cosa, prosa
en cajas, y por eso la presentación parecía el documento transformado otra vez en vez de una
presentación. Un deck de verdad varía: abre planteando algo, enseña una cifra sola, pone dos cosas
una al lado de la otra, deja hablar al documento, cierra.

`dato` y `cita` además OBLIGAN el anclaje, y eso no es decorativo: una cifra sacada del documento
y una frase textual son justo lo que tiene que poder comprobarse. El rediseño sube, por
construcción, la parte de la presentación que se puede verificar contra la fuente.
"""


class LadoDeComparacion(_Strict):
    """Una de las dos columnas de una diapositiva `comparacion`."""

    titulo: str = Field(min_length=1)
    puntos: list[str] = Field(default_factory=list, max_length=4)


class Comparacion(_Strict):
    """Dos cosas que el lector confunde, puestas una al lado de la otra."""

    izquierda: LadoDeComparacion
    derecha: LadoDeComparacion


EvidenciaVisual = Annotated[
    TableContent | ChartContent | TimelineContent,
    Field(discriminator="content_type"),
]
"""Lo que SOSTIENE la afirmación de una diapositiva, cuando no es texto.

Son los mismos tipos que ya usa el contenido del documento, a propósito: la aplicación sabe
dibujarlos, están validados y, en el caso del gráfico, pasan por la misma regla de isomorfismo. No
hay un renderizador nuevo ni un contrato paralelo.

Existe porque faltaba la otra mitad del modelo que esto sigue. Una diapositiva es una afirmación
sostenida por EVIDENCIA, y la evidencia es visual; poner un párrafo debajo de la afirmación deja
la misma perspectiva que el documento, solo que más corta. Esa era la queja, y era correcta.

`TextContent` queda fuera de la unión aunque sea del mismo grupo: el texto ya tiene su sitio en
`body`, y dos maneras de decir lo mismo son dos sitios donde mirar.
"""


class GeneratedSlide(_Strict):
    """Una diapositiva de la presentación GENERADA (síntesis propia desde la fuente).

    Trazabilidad por slide (mix honesto): `source` + `grounding` si se ancló a una cita del
    documento; `is_synthesis=True` si es una simplificación declarada (sin cita exacta); el raro
    `not_found` si el modelo diera una cita inexistente. `illustration` (opcional) reusa el tipo
    del 5h con su etiqueta obligatoria.
    """

    papel: PapelDeSlide = "afirmacion"
    cifra: str | None = Field(
        default=None,
        max_length=16,
        description="Solo `dato`: la cifra tal como se muestra, con su unidad. Ej: «80 km».",
    )
    """Corta a propósito. Una diapositiva `dato` existe para que se vea UN número desde el fondo
    de la sala; si cupiera una frase, dejaría de ser un dato y sería una afirmación."""
    comparacion: Comparacion | None = None
    evidencia: EvidenciaVisual | None = None
    title: str = Field(min_length=1)
    body: str | None = None  # frase/idea central (no todo tiene que ser viñetas)
    bullets: list[str] = Field(default_factory=list)
    source: SourceReference | None = None
    grounding: GroundingStatus = "not_found"
    start_s: float | None = Field(default=None, ge=0)
    """Solo audio: momento del que viene la cita, igual que en `SectionGrounding` y en la
    respuesta del chat. Sin esto, abrir la fuente desde una diapositiva arrancaba el reproductor
    en 0:00 en vez de en la cita: una inconsistencia entre vistas del mismo documento."""
    region: CitedRegion | None = None
    """Solo PDF: dónde está la cita dentro de la página, igual que en `SectionGrounding`. Sin
    esto, abrir la fuente desde una diapositiva daría menos precisión que desde una sección del
    contenido: una inconsistencia entre vistas del mismo documento."""
    is_synthesis: bool = False
    illustration: GeneratedIllustration | None = None


class GeneratedDeck(_Strict):
    """Presentación en diapositivas generada (guion propio, desde la fuente). Artefacto on-demand,
    separado del contrato de `Presentation`."""

    hilo: str | None = Field(
        default=None,
        description="En una frase, qué defiende la presentación entera.",
    )
    """Lo que convierte catorce láminas sueltas en algo que va a alguna parte.

    Se le pide al modelo ANTES de escribir ninguna diapositiva, y por eso está aquí y no en una:
    es la decisión de la que cuelgan las demás. Opcional porque las presentaciones guardadas antes
    de esto no lo tienen, y una biblioteca que deje de abrirse por un campo nuevo no vale lo que
    cuesta."""

    slides: list[GeneratedSlide] = Field(min_length=1)


# --- Eventos SSE del endpoint /transform/stream (Hito 5d) ---
# Cada `Section` streameada es indistinguible en forma de una del contrato no-streaming.


class StreamTranscript(_Strict):
    """Lo que la Fase 0 oyó en el audio, emitido ANTES de que empiece la estructuración.

    Dos razones para que viaje al frontend, y ninguna contradice el principio de no aplanar
    (ese principio rige lo que entra al MODELO para que lo interprete, no lo que se le muestra
    al lector para que verifique: esto último aumenta la trazabilidad):

    1. La percepción añade varios segundos antes de la primera sección; con la transcripción en
       la mano, el adelanto del audio deja de ser un hueco y pasa a decir qué se dijo.
    2. El panel de fuente puede mostrar la transcripción completa con la cita resaltada, que es
       el equivalente honesto de lo que ya hace con un documento de texto.

    Sigue sin ser verificable contra la señal: es lo que el modelo de percepción OYÓ. La UI lo
    dice, y el grounding de las secciones sigue siendo `unverified`.
    """

    type: Literal["transcript"] = "transcript"
    text: str
    speaker_count: int = Field(ge=1)
    evidence: str
    """La `AudioEvidence` completa serializada. El frontend la guarda como un bloque OPACO (no
    la interpreta) y la reenvía al chat, a las sugeridas y al deck, que así releen el mismo
    documento sin volver a percibir el audio, ni pagar, ni arriesgarse a que la anotación
    cambie entre turnos. Lleva los hablantes y el énfasis, no solo el texto: sin eso el chat no
    podría responder "¿quién dijo el 15%?", que es justo donde el audio aporta algo."""


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
