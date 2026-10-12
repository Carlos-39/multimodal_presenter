"""Presentación en diapositivas GENERADA (guion propio, desde la fuente).

Herramienta de comprensión en paralelo al texto estructurado (transform) y al audio (narración):
una síntesis NUEVA pensada para el formato diapositiva, generada releyendo el DOCUMENTO ORIGINAL
(como el chat del Hito 6), no re-componiendo las `Section` ya generadas (eso es la vista de slides
del 5h, que es otra cosa). On-demand y cacheada por documento.

Trazabilidad por slide (mix honesto): se ancla a una cita exacta cuando es limpio; se marca como
`is_synthesis` cuando simplifica contenido complejo sin cita exacta; `not_found` si el modelo diera
una cita inexistente. Imágenes: reusa el pipeline de ilustraciones del 5h (gpt-image-1) con su
etiqueta obligatoria — sin sistema de imágenes paralelo.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models import Model

from ..config import Settings
from ..schemas.presentation import GeneratedIllustration
from ..schemas.transform import GeneratedDeck, GeneratedSlide
from .illustration import _generate_image, has_image_provider
from .models import ExtractionResult
from .pdf_locator import abrir_localizador
from .validation import ground_quote

_IMAGE_CAP = 3  # techo de imágenes por deck: imágenes solo donde aporten de verdad (y acota costo)

_DECK_SYSTEM = (
    "Genera una PRESENTACIÓN EN DIAPOSITIVAS a partir del documento que recibes. Es una síntesis "
    "nueva pensada para leerse como slides, no un resumen corrido. Reglas OBLIGATORIAS:\n"
    "- UNA idea central por slide. Si una parte tiene dos ideas separables, son DOS slides.\n"
    "- Jerarquía: un título claro por slide; un elemento dominante; el resto, soporte.\n"
    "- NO todo en viñetas. Varía el formato según el contenido: usa `body` (una frase o idea "
    "central corta) para conceptos o ideas clave; usa `bullets` SOLO para enumeraciones reales; "
    "una slide puede apoyarse sobre todo en su imagen. No fuerces viñetas donde no encajan.\n"
    "- Densidad: si usas viñetas, máximo ~6 y ~6 palabras cada una; si usas `body`, 1-2 frases "
    "cortas. El texto es apoyo visual, nunca un párrafo largo.\n"
    "- Consistencia de estilo entre slides; prioriza la legibilidad.\n"
    "Trazabilidad por slide: cuando el contenido venga claramente de una frase del documento, "
    "copia esa frase EXACTA en `source_quote` (sin parafrasear) y pon `synthesis` en false. Si "
    "la slide SIMPLIFICA algo complejo y ninguna frase exacta la respalda, deja `source_quote` "
    "en null y `synthesis` en true (simplificación honesta). Nunca inventes una cita. En PDF, "
    "indica la página en `source_page`.\n"
    "Apoyo visual (sé SELECTIVO: solo si una ilustración aclara de verdad, no por rellenar): si "
    "una slide describe un proceso físico, un mecanismo o estructura espacial, o una secuencia "
    "visual, da un `image_prompt` DETALLADO que describa una ilustración que EXPLIQUE el concepto "
    "SOLO con elementos visuales: nombra los objetos a dibujar y cómo se relacionan o fluyen "
    "(flechas, posición, color). La imagen debe entenderse SOLA, sin leyenda: NO pidas texto ni "
    "etiquetas dentro de ella, y NO pidas pasos numerados — una secuencia se muestra colocando "
    "las etapas en orden con flechas. Si no aporta una ilustración, `image_prompt` en null.\n"
    "Responde en el idioma del documento."
)


class _SlidePlan(BaseModel):
    title: str = Field(min_length=1)
    body: str | None = None
    bullets: list[str] = Field(default_factory=list)
    source_quote: str | None = None
    source_page: int | None = None
    synthesis: bool = False
    image_prompt: str | None = None


class _DeckPlan(BaseModel):
    slides: list[_SlidePlan] = Field(default_factory=list)


deck_agent = Agent(output_type=PromptedOutput(_DeckPlan), system_prompt=_DECK_SYSTEM)

_cache: dict[str, GeneratedDeck] = {}


def _doc_parts(extraction: ExtractionResult) -> list[str | BinaryContent]:
    if extraction.source_kind == "text":
        assert extraction.text is not None
        return [f"--- DOCUMENTO ---\n{extraction.text}\n--- FIN DEL DOCUMENTO ---"]
    if extraction.source_kind == "audio":
        # Igual que el chat: el audio entra como la evidencia de la Fase 0, nunca como binario.
        assert extraction.audio_evidence is not None
        return [
            "--- EVIDENCIA ACÚSTICA DEL AUDIO (JSON) ---\n"
            f"{extraction.audio_evidence.model_dump_json(indent=2)}\n"
            "--- FIN DE LA EVIDENCIA ---\n"
            "Atribuye cada idea a su hablante si hay más de uno, y matiza las cifras dichas con "
            'duda (`delivery: "dubitativo"`). Las citas deben ser literales de `segments[].text`.'
        ]
    assert extraction.binary is not None and extraction.media_type is not None
    return [
        "--- DOCUMENTO (adjunto) ---",
        BinaryContent(data=extraction.binary, media_type=extraction.media_type),
    ]


async def generate_deck(
    model: Model, settings: Settings, extraction: ExtractionResult
) -> GeneratedDeck:
    """Genera (o recupera de caché) el deck de diapositivas desde la fuente."""
    key = extraction.document_id
    if key in _cache:
        return _cache[key]

    parts: list = [*_doc_parts(extraction), "Genera la presentación en diapositivas."]
    result = await deck_agent.run(parts, model=model)
    plans = result.output.slides or []

    images_made = 0
    can_make_images = has_image_provider(settings)
    slides: list[GeneratedSlide] = []
    # Una sola apertura del PDF para todas las diapositivas, igual que en la presentación.
    with abrir_localizador(extraction.source_kind, extraction.binary) as localizador:
        for plan in plans:
            # Trazabilidad por slide (mix honesto).
            source = None
            grounding = "not_found"
            start_s = None
            region = None
            is_synthesis = False
            if plan.synthesis or not plan.source_quote:
                is_synthesis = True
            else:
                ancla = ground_quote(plan.source_quote, plan.source_page, extraction, localizador)
                source, grounding = ancla.source, ancla.status
                start_s, region = ancla.start_s, ancla.region

            # Apoyo visual: reusa el generador de ilustraciones (con etiqueta obligatoria), acotado.
            illustration = None
            if plan.image_prompt and can_make_images and images_made < _IMAGE_CAP:
                try:
                    data_uri = await _generate_image(settings, plan.image_prompt)
                    illustration = GeneratedIllustration(
                        image_url=data_uri, alt=f"Apoyo visual: {plan.title}"
                    )
                    images_made += 1
                except Exception:  # noqa: BLE001 — la imagen es un extra; sin ella la slide sigue
                    illustration = None

            slides.append(
                GeneratedSlide(
                    title=plan.title,
                    body=plan.body,
                    bullets=plan.bullets[:6],
                    source=source,
                    grounding=grounding,
                    start_s=start_s,
                    region=region,
                    is_synthesis=is_synthesis,
                    illustration=illustration,
                )
            )

    if not slides:  # nunca un deck vacío: una slide con el título del documento
        slides = [GeneratedSlide(title="Presentación", bullets=[], is_synthesis=True)]
    deck = GeneratedDeck(slides=slides)
    _cache[key] = deck
    return deck
