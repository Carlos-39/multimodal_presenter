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

import logfire
from pydantic import BaseModel, Field, ValidationError
from pydantic_ai import Agent, BinaryContent, PromptedOutput
from pydantic_ai.models import Model

from ..config import Settings
from ..schemas.transform import (
    Comparacion,
    GeneratedDeck,
    GeneratedSlide,
    LadoDeComparacion,
    PapelDeSlide,
)
from .illustration import _generate_image, has_image_provider, leer_ilustracion
from .models import ExtractionResult
from .pdf_locator import abrir_localizador
from .validation import ground_quote

#: Lo que cabe en una cifra. El mismo número vive en el contrato público, y los dos tienen
#: que coincidir: si el plan admite más de lo que el contrato acepta, la diapositiva revienta
#: al montarse. Hay un test que comprueba justo eso.
_CIFRA_MAX = 16

#: Lo que cabe en el cuerpo de una lámina, en caracteres. Unas 35 palabras en español.
#:
#: Es un tope DURO y vive en el plan, no solo en el prompt, porque la indicación blanda no
#: bastó: pedí «2 o 3 frases» y llegaron párrafos de 70 palabras. Con el tope aquí, pydantic
#: le devuelve el error al modelo y este parte la lámina en dos, que es lo que había que
#: hacer desde el principio. Un párrafo en una diapositiva deja de ser una diapositiva.
_BODY_MAX = 280

_DECK_SYSTEM = (
    "Genera una PRESENTACIÓN EN DIAPOSITIVAS a partir del documento que recibes. Es una síntesis "
    "nueva pensada para leerse como slides, no un resumen corrido. Si al terminar se parece al "
    "documento troceado en cajas, no has hecho una presentación: has repetido el documento.\n"
    "\n"
    "PRIMERO EL HILO. Antes de escribir ninguna diapositiva, decide en UNA frase qué defiende la "
    "presentación entera y ponla en `hilo`. Todo lo demás cuelga de ahí: una presentación va a "
    "alguna parte, y si no sabes a dónde, salen láminas sueltas.\n"
    "\n"
    "CADA DIAPOSITIVA DECLARA SU `papel`, y el papel decide su forma. VARÍA: una presentación "
    "donde todo son `afirmacion` es exactamente el problema que esto viene a resolver.\n"
    "- `apertura`: SOLO la primera. Plantea la tensión o la pregunta que el documento resuelve, "
    "en `title`, en una frase. Sin `body`, sin viñetas. Pide `image_prompt` con "
    "`imagen_evocadora` en true: una imagen que ambienta, que dice de qué va esto antes de leer.\n"
    "- `cierre`: SOLO la última. Qué se lleva quien la vio, en `title`. También admite imagen "
    "evocadora.\n"
    "- `dato`: UNA cifra que importe, en `cifra` tal como se lee («80 km», «15,3 %», «99"
    " estudiantes»), y en `body` una frase con qué significa o contra qué se compara. Sin "
    "viñetas. EL TÍTULO NO REPITE LA CIFRA: la cifra ya se ve enorme debajo, y decirla dos veces "
    "gasta la lámina. Mal: «A 50-90 km de altura, donde empieza el espectáculo». Bien: «Más alto "
    "que cualquier avión, y por eso casi nadie los ve». La cifra sale del documento, así que ESTA "
    "SIEMPRE VA ANCLADA: copia en `source_quote` la frase exacta donde aparece.\n"
    "- `comparacion`: dos cosas que el lector confunde o que el documento contrapone. Llena "
    "`comparacion` con los dos lados, cada uno con su `titulo` y de dos a cuatro `puntos` cortos "
    "y PARALELOS (si el primero habla de altura, el primero del otro lado también). En `title`, "
    "qué los separa.\n"
    "- `cita`: cuando una frase del documento dice algo mejor de lo que tú lo dirías. La frase "
    "EXACTA va en `source_quote` y es lo que se muestra en grande; `title` es qué hay que notar "
    "en ella. Sin `body`. Nunca `synthesis`.\n"
    "- `figura`: la imagen ES la diapositiva. `title` corto y la imagen explicando lo que el "
    "texto no puede.\n"
    "- `afirmacion`: lo de siempre, para todo lo demás.\n"
    "\n"
    "LO QUE TIENE QUE HACER UNA `afirmacion`. AFIRMA algo y lo SOSTIENE. No es "
    "una etiqueta con una lista debajo.\n"
    "- El `title` es la afirmación: una frase que dice algo que podría discutirse, no un rótulo "
    "de índice. Mal: «El mecanismo: de un rayo al resplandor». Bien: «El resplandor no lo "
    "enciende el rayo, sino el hueco que el rayo deja».\n"
    "- El `body` sostiene la afirmación, y es CORTO: 35 palabras como mucho, una o dos frases. "
    "Esto es un tope duro, no una sugerencia. Un párrafo en una diapositiva deja de ser una "
    "diapositiva y vuelve a ser el documento, que es justo lo que esto no quiere ser. Si no cabe "
    "en 35 palabras, es que hay dos ideas: parte la lámina en dos.\n"
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
    "- La apertura y el cierre son la excepción: ahí la imagen AMBIENTA en vez de explicar, y se "
    "marca con `imagen_evocadora` en true. A esa no le exijas que enseñe nada.\n"
    "- Hay un presupuesto de imágenes y es pequeño. Si dudas, no la pidas.\n"
    "Responde en el idioma del documento."
)


class _LadoPlan(BaseModel):
    titulo: str = Field(min_length=1)
    puntos: list[str] = Field(default_factory=list)


class _ComparacionPlan(BaseModel):
    izquierda: _LadoPlan
    derecha: _LadoPlan


class _SlidePlan(BaseModel):
    papel: PapelDeSlide = "afirmacion"
    title: str = Field(min_length=1)
    body: str | None = Field(default=None, max_length=_BODY_MAX)
    bullets: list[str] = Field(default_factory=list)
    #: El mismo tope que el contrato público, y esa es toda la gracia: aquí pydantic puede
    #: devolverle el error al modelo para que lo corrija. Sin el tope, el plan aceptaba «un 15,3
    #: por ciento más» y reventaba después, al montar la diapositiva, con un 500 en producción.
    cifra: str | None = Field(default=None, max_length=_CIFRA_MAX)
    comparacion: _ComparacionPlan | None = None
    source_quote: str | None = None
    source_page: int | None = None
    synthesis: bool = False
    image_prompt: str | None = None
    #: `evocadora` para la apertura y el cierre: ambienta en vez de explicar, así que no pasa por
    #: el filtro de «¿qué aprendo mirándola?» ni lleva clave debajo.
    imagen_evocadora: bool = False


class _DeckPlan(BaseModel):
    hilo: str = Field(default="", description="En una frase, qué defiende la presentación.")
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


def _presupuesto_de_imagenes(n_slides: int) -> int:
    """Cuántas imágenes puede llevar una presentación de `n_slides`.

    Proporcional y no fijo. El tope de dos era arbitrario: lo puse bajo cuando el problema era que
    sobraban imágenes, pero ahora cada una pasa por un filtro que mira el dibujo y descarta las
    decorativas, así que se puede aflojar sin que vuelva la basura. Lo que sigue costando dinero
    es que una descartada ya se pagó, y por eso el techo se queda.
    """
    return min(5, max(2, -(-n_slides // 4)))


def _cifra(plan: _SlidePlan) -> str | None:
    """La cifra, solo si cabe y si la diapositiva es de ese papel.

    Es la segunda red, y hace falta aunque el plan ya tenga el tope. Lo que llega aquí lo escribió
    un modelo, y una diapositiva que no se puede montar tiraba la PRESENTACIÓN ENTERA con un 500:
    una lámina perdiendo su número es un mal menor comparado con eso. Sin cifra, el frontend la
    compone como una afirmación, que es la caída que ya estaba prevista.
    """
    if plan.papel != "dato" or not plan.cifra:
        return None
    cifra = plan.cifra.strip()
    return cifra if cifra and len(cifra) <= _CIFRA_MAX else None


def _comparacion(plan: _SlidePlan) -> Comparacion | None:
    """Pasa la comparación del plan al contrato, solo si la diapositiva es de ese papel."""
    if plan.papel != "comparacion" or plan.comparacion is None:
        return None
    lados = plan.comparacion
    return Comparacion(
        izquierda=LadoDeComparacion(
            titulo=lados.izquierda.titulo, puntos=lados.izquierda.puntos[:4]
        ),
        derecha=LadoDeComparacion(titulo=lados.derecha.titulo, puntos=lados.derecha.puntos[:4]),
    )


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
    presupuesto = _presupuesto_de_imagenes(len(plans))
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
            if plan.image_prompt and can_make_images and images_made < presupuesto:
                try:
                    data_uri = await _generate_image(settings, plan.image_prompt)
                    # La clave y el texto alternativo se escriben MIRANDO la imagen, y esa misma
                    # lectura puede tirarla por decorativa. El `alt` de antes se armaba solo
                    # («Apoyo visual: » más el título), que no describe nada para quien usa un
                    # lector de pantalla: decía de qué iba la diapositiva, no qué se ve.
                    #
                    # La evocadora no pasa por ese filtro, y no es una excepción cómoda: su
                    # trabajo es otro. Una apertura existe para ambientar, para decir de qué va
                    # esto antes de leer nada, y preguntarle «¿qué aprendo mirándote?» es
                    # preguntarle por un trabajo que no es el suyo.
                    contexto = f"{plan.title}\n{plan.body or ' '.join(plan.bullets)}".strip()
                    illustration = await leer_ilustracion(
                        model, data_uri, contexto, exigir_utilidad=not plan.imagen_evocadora
                    )
                    # Cuenta contra el presupuesto aunque se descarte: la imagen ya se pagó, y
                    # permitir reintentos hasta que una pase lo convertiría en un suelo.
                    images_made += 1
                except Exception:  # noqa: BLE001 (la imagen es un extra; sin ella la slide sigue)
                    illustration = None

            try:
                slides.append(
                    GeneratedSlide(
                        papel=plan.papel,
                        title=plan.title,
                        body=plan.body,
                        bullets=plan.bullets[:6],
                        cifra=_cifra(plan),
                        comparacion=_comparacion(plan),
                        source=source,
                        grounding=grounding,
                        start_s=start_s,
                        region=region,
                        is_synthesis=is_synthesis,
                        illustration=illustration,
                    )
                )
            except ValidationError as exc:
                # Lo que entra aquí lo escribió un modelo, y una lámina que no valida se llevaba
                # por delante la PRESENTACIÓN ENTERA con un 500. Pasó en producción: el plan
                # admitía una cifra más larga de la que el contrato acepta.
                #
                # Se registra el campo que falló, no el valor: lo que hace falta para arreglarlo
                # es saber QUÉ campo se desincronizó, y el valor es contenido del documento.
                campos = ", ".join(str(e.get("loc", ("?",))[0]) for e in exc.errors()) or "?"
                logfire.warn(
                    "deck: una diapositiva no validó y se descarta (campos: {campos})",
                    campos=campos,
                )

    if not slides:  # nunca un deck vacío: una slide con el título del documento
        slides = [GeneratedSlide(title="Presentación", bullets=[], is_synthesis=True)]
    deck = GeneratedDeck(hilo=result.output.hilo or None, slides=slides)
    _cache[key] = deck
    return deck
