"""Presentación en diapositivas GENERADA (guion propio, desde la fuente).

Herramienta de comprensión en paralelo al texto estructurado (transform) y al audio (narración):
una síntesis NUEVA pensada para el formato diapositiva, generada releyendo el DOCUMENTO ORIGINAL
(como el chat del Hito 6), no re-componiendo las `Section` ya generadas (eso es la vista de slides
del 5h, que es otra cosa). On-demand y cacheada por documento.

Trazabilidad por slide (mix honesto): se ancla a una cita exacta cuando es limpio; se marca como
`is_synthesis` cuando simplifica contenido complejo sin cita exacta; `not_found` si el modelo diera
una cita inexistente. Imágenes: reusa el pipeline de ilustraciones del 5h (gpt-image-1) con su
etiqueta obligatoria: sin sistema de imágenes paralelo.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models import Model

from ..config import Settings
from ..schemas.transform import GeneratedDeck, GeneratedSlide
from .illustration import _generate_image, has_image_provider, leer_ilustracion
from .models import ExtractionResult
from .pdf_locator import abrir_localizador
from .validation import ground_quote

#: Techo de imágenes por presentación. Bajó de 3 a 2 con el rediseño: el problema de las
#: ilustraciones no era que hubiera pocas, era que estaban por estar. Menos, y cada una
#: ganándose el sitio.
_IMAGE_CAP = 2

_DECK_SYSTEM = (
    "Genera una PRESENTACIÓN EN DIAPOSITIVAS a partir del documento que recibes. Es una síntesis "
    "nueva pensada para leerse como slides, no un resumen corrido.\n"
    "\n"
    "LO QUE TIENE QUE HACER CADA DIAPOSITIVA. Una diapositiva AFIRMA algo y lo SOSTIENE. No es "
    "una etiqueta con una lista debajo.\n"
    "- El `title` es la afirmación: una frase que dice algo que podría discutirse, no un rótulo "
    "de índice. Mal: «El mecanismo: de un rayo al resplandor». Bien: «El resplandor no lo "
    "enciende el rayo, sino el hueco que el rayo deja».\n"
    "- El `body` es el porqué, y es lo normal: 2 o 3 frases que hacen que la afirmación se "
    "sostenga sola, con los nexos escritos («porque», «así que», «y eso deja»). Quien lea la "
    "diapositiva sin el documento al lado tiene que entenderla entera.\n"
    "- UNA idea por diapositiva. Si hay dos ideas separables, son DOS diapositivas.\n"
    "\n"
    "LAS VIÑETAS SON LA EXCEPCIÓN, no el formato por defecto. Úsalas SOLO para enumeraciones de "
    "verdad (tres instrumentos, cuatro países, dos grupos del estudio) donde el orden no implica "
    "causa. Máximo 4, y cada una una cláusula completa, no un fragmento telegráfico.\n"
    "- Una CADENA CAUSAL nunca va en viñetas. Si los puntos se encadenan («esto provoca aquello, "
    "que a su vez…»), el nexo entre ellos ES la explicación, y en una lista el nexo desaparece: "
    "va en `body`, en prosa.\n"
    "\n"
    "Trazabilidad por slide: cuando el contenido venga claramente de una frase del documento, "
    "copia esa frase EXACTA en `source_quote` (sin parafrasear) y pon `synthesis` en false. Si "
    "la slide SIMPLIFICA algo complejo y ninguna frase exacta la respalda, deja `source_quote` "
    "en null y `synthesis` en true (simplificación honesta). Nunca inventes una cita. En PDF, "
    "indica la página en `source_page`.\n"
    "\n"
    "APOYO VISUAL. La prueba es esta: si alguien puede imaginarse la cosa con solo leer tu "
    "`body`, NO hay imagen. Solo pide una cuando lo difícil sea algo que se VE, el aspecto de "
    "algo, su tamaño frente a otra cosa, cómo están dispuestos unos elementos respecto a otros. "
    "Una imagen no puede sostener un argumento ni una causa: eso ya lo hace tu texto. Así que "
    "no pidas «una ilustración que explique el mecanismo»; pide la COSA concreta que hay que ver.\n"
    "- Si la pides, `image_prompt` en español y detallado: nombra los objetos a dibujar, su "
    "disposición y sus colores. La imagen NO llevará ni una palabra dentro (se dibujan mal y "
    "quedarían con faltas), así que NO pidas texto, etiquetas, leyendas ni pasos numerados.\n"
    "- Como mucho DOS diapositivas de toda la presentación llevan imagen. Si dudas, no la pidas.\n"
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
                    # La clave y el texto alternativo se escriben MIRANDO la imagen, y esa misma
                    # lectura puede tirarla por decorativa. El `alt` de antes se armaba solo
                    # («Apoyo visual: » más el título), que no describe nada para quien usa un
                    # lector de pantalla: decía de qué iba la diapositiva, no qué se ve.
                    contexto = f"{plan.title}\n{plan.body or ' '.join(plan.bullets)}".strip()
                    illustration = await leer_ilustracion(model, data_uri, contexto)
                    # Cuenta contra el techo aunque se descarte: la imagen ya se pagó, y permitir
                    # reintentos hasta que una pase convertiría el techo en un suelo.
                    images_made += 1
                except Exception:  # noqa: BLE001 (la imagen es un extra; sin ella la slide sigue)
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
