"""Ilustraciones de apoyo GENERADAS (Hito 5h Parte 1).

Reapertura acotada de una decisión de Fase 2: se genera una ilustración SOLO cuando (1) la sección
no tiene imagen real del documento (a nivel de documento: solo fuentes de texto, que no traen
imágenes), (2) el contenido se beneficia genuinamente de apoyo visual (proceso físico, mecanismo
espacial o secuencia visual — rúbrica fija, no juicio libre), y (3) es ayuda didáctica, nunca
prueba (estructuralmente: `GeneratedIllustration` no tiene `source`). Etiqueta obligatoria siempre.

Flujo: un clasificador barato (Haiku) decide qué núcleos califican y da un prompt de imagen; luego
se genera la imagen. Cacheado por documento. Techo de seguridad para acotar el costo. La condición 1
(solo texto) la aplica el frontend al decidir si llama a este flujo.

Generación de imagen (compartida con el deck 5j): proveedor PRIMARIO Ideogram (mejores dibujos), con
FALLBACK a OpenAI gpt-image-1 si falla (patrón como el FallbackModel del LLM). Las imágenes se
generan **SIN texto** (las etiquetas van en el HTML de la slide): así se evitan los typos que los
modelos de imagen cometen al "dibujar" palabras, y el texto que ve el usuario es siempre correcto.
"""

from __future__ import annotations

import base64
import hashlib

import httpx
import logfire
import truststore
from pydantic import BaseModel, Field
from pydantic_ai import Agent, PromptedOutput
from pydantic_ai.models import Model

from ..config import Settings
from ..schemas.presentation import (
    ChartContent,
    GeneratedIllustration,
    Presentation,
    TableContent,
    TextContent,
    TimelineContent,
)

truststore.inject_into_ssl()  # SSL del sistema (Windows)

_SAFETY_CAP = 4  # techo por documento: la rúbrica suele dar 1-2; esto acota el peor caso de costo
# La imagen tiene que ENTENDERSE SOLA. No basta con que no lleve texto: tampoco puede llevar
# marcas que remitan a información que no está dentro de la imagen — numeración de pasos, letras
# clave, leyendas, líneas guía que apuntan a un hueco. Una referencia huérfana es PEOR que nada,
# porque el lector busca una explicación que no existe. (Lo señaló el autor al revisar la batería
# de diagnóstico: una foto con símbolos y sin clave deja peor a quien no conoce el tema.)
#
# Va en INGLÉS y con la restricción PRIMERO, no enterrada al final: así se midió que funciona.
# Y se dice también en POSITIVO (con qué SÍ se construye el significado), porque los modelos de
# imagen siguen mal las instrucciones puramente negativas.
_IMAGE_STYLE_PREFIX = (
    "SELF-EXPLANATORY WORDLESS ILLUSTRATION. Someone who knows nothing about the topic must "
    "understand it from the picture alone, with no key or caption to consult.\n"
    "The image contains NO writing and NO reference marks: no words, labels, captions or titles; "
    "no callout numbers like (1) (2) (3); no letter keys; no legend; no leader lines pointing at "
    "empty space; no watermark or signature.\n"
    "Show meaning only with: recognizable objects drawn clearly, their arrangement in space, "
    "arrows for direction or flow, and colour. If there is a sequence, lay the stages out in "
    "reading order with arrows between them — never number them.\n"
    "Clean light background, detailed and clear artwork, not a vague abstract icon.\n"
    "Subject to depict: "
)


def has_image_provider(settings: Settings) -> bool:
    """¿Hay con qué generar imágenes? (Gemini primario, Ideogram u OpenAI de respaldo)."""
    return bool(settings.google_api_key or settings.ideogram_api_key or settings.openai_api_key)


class _Plan(BaseModel):
    section_id: str
    image_prompt: str = Field(min_length=1)


class _PlanList(BaseModel):
    items: list[_Plan] = Field(default_factory=list)


_CLASSIFY_SYSTEM = (
    "Recibes las secciones NÚCLEO de una presentación. Marca SOLO las que se benefician "
    "genuinamente de una ilustración de apoyo: contenido que describe un PROCESO físico/natural, "
    "un MECANISMO o estructura ESPACIAL, o una SECUENCIA visual. NO marques texto conceptual, "
    "definicional, narrativo, argumentativo, de datos/cifras ni resúmenes. Para cada sección "
    "marcada, da un `image_prompt` en español DETALLADO que describa una ilustración que EXPLIQUE "
    "el concepto SOLO con elementos visuales: nombra los objetos a dibujar y cómo se relacionan o "
    "fluyen (flechas, posición, color). La imagen debe entenderse SOLA, sin leyenda: NO pidas "
    "texto ni etiquetas dentro de ella, y NO pidas pasos numerados — una secuencia se muestra "
    "colocando las etapas en orden con flechas. Devuelve SOLO las secciones que califican (puede "
    "ser ninguna)."
)

classify_agent = Agent(output_type=PromptedOutput(_PlanList), system_prompt=_CLASSIFY_SYSTEM)

_cache: dict[str, list[tuple[str, GeneratedIllustration]]] = {}


def _content_text(content: object) -> str:
    if isinstance(content, TextContent):
        return content.text
    if isinstance(content, TableContent):
        return f"[tabla: {', '.join(content.columns)}]"
    if isinstance(content, ChartContent):
        return f"[gráfico {content.chart_type}]"
    if isinstance(content, TimelineContent):
        return "[línea de tiempo]"
    return ""


def _cores_digest(presentation: Presentation) -> tuple[str, str]:
    cores = [s for s in presentation.sections if s.role == "core"]
    parts = [presentation.title]
    for s in cores:
        parts.append(f"[{s.id}] {s.title or ''}: {_content_text(s.content)}".strip())
    text = "\n".join(parts)
    return text, hashlib.sha256(text.encode("utf-8")).hexdigest()


async def _classify(model: Model, presentation: Presentation) -> list[_Plan]:
    cores = [s for s in presentation.sections if s.role == "core"]
    if not cores:
        return []
    text, _ = _cores_digest(presentation)
    result = await classify_agent.run(
        f"Secciones núcleo:\n{text}\n\n¿Cuáles se benefician de una ilustración de apoyo?",
        model=model,
    )
    core_ids = {s.id for s in cores}
    seen: set[str] = set()
    plans: list[_Plan] = []
    for p in result.output.items:
        if p.section_id in core_ids and p.section_id not in seen:
            seen.add(p.section_id)
            plans.append(p)
    return plans[:_SAFETY_CAP]


_IDEOGRAM_URL = "https://api.ideogram.ai/v1/ideogram-v3/generate"

# Ideogram v3 acepta `negative_prompt` (describir qué excluir). Refuerza la opción 2 (imágenes sin
# texto): las palabras las dibujan mal y las etiquetas van en la slide. Se excluyen palabras/letras,
# NO números (excluirlos sería demasiado y una cifra natural a veces ayuda). Solo aplica a Ideogram;
# gpt-image-1 (fallback) no tiene este parámetro y depende de la instrucción del prompt.
_IDEOGRAM_NEGATIVE = (
    "texto, palabras, letras, etiquetas, leyendas, títulos, subtítulos, marcas de agua, logotipos"
)


async def _gemini_image(settings: Settings, prompt: str) -> str:
    """Genera con Gemini (PRIMARIO). Devuelve data URI. Lanza si falla.

    Pasó a ser el primario tras medirlo contra Ideogram con los mismos prompts reales: 0 de 6
    imágenes con palabras inventadas frente a 3 de 6, y además más barato ($0.067 frente a
    $0.090). No hace falta clave nueva: usa la `GOOGLE_API_KEY` que ya usan la percepción de
    audio y el fallback de estructuración.

    No tiene `negative_prompt`: toda la restricción va en el prompt, que ya la lleva delante.
    La proporción y el tamaño se fijan — sin ellos la imagen sale apaisada con bandas, y el
    tamaño es lo que clava el precio por imagen.
    """
    from google import genai
    from google.genai import types

    cliente = genai.Client(api_key=settings.google_api_key)
    respuesta = await cliente.aio.models.generate_content(
        model=settings.google_image_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio=settings.google_image_aspect_ratio,
                image_size=settings.google_image_size,
            ),
        ),
    )
    for parte in respuesta.candidates[0].content.parts:
        datos = getattr(parte, "inline_data", None)
        if datos and datos.data:
            crudo = datos.data if isinstance(datos.data, bytes) else base64.b64decode(datos.data)
            tipo = datos.mime_type or "image/png"
            return f"data:{tipo};base64,{base64.b64encode(crudo).decode('ascii')}"
    # Gemini filtra por seguridad con más agresividad que los otros: si rechaza el prompt no
    # devuelve imagen. Se lanza para que el respaldo tome el relevo, que es justo su razón de ser.
    raise RuntimeError("Gemini no devolvió imagen (¿filtro de seguridad?)")


async def _ideogram_image(settings: Settings, prompt: str) -> str:
    """Genera con Ideogram v3 (primario). Devuelve data URI. Lanza si falla."""
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            _IDEOGRAM_URL,
            headers={"Api-Key": settings.ideogram_api_key or ""},
            files={
                "prompt": (None, prompt),
                "negative_prompt": (None, _IDEOGRAM_NEGATIVE),
                "rendering_speed": (None, settings.ideogram_rendering_speed),
                "aspect_ratio": (None, "1x1"),
                "magic_prompt": (None, "OFF"),
            },
        )
        resp.raise_for_status()
        url = resp.json()["data"][0]["url"]
        img = await client.get(url)
        img.raise_for_status()
        ctype = img.headers.get("content-type", "image/png").split(";")[0]
        b64 = base64.b64encode(img.content).decode("ascii")
        return f"data:{ctype};base64,{b64}"


async def _openai_image(settings: Settings, prompt: str) -> str:
    """Genera con OpenAI gpt-image-1 (fallback). Devuelve data URI."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.images.generate(
        model=settings.openai_image_model,
        prompt=prompt,
        size="1024x1024",
        quality=settings.openai_image_quality,
        n=1,
    )
    return f"data:image/png;base64,{response.data[0].b64_json}"


async def _generate_image(settings: Settings, image_prompt: str) -> str:
    """Genera la imagen como data URI. Gemini primario; Ideogram y OpenAI como respaldos.

    La restricción va DELANTE del asunto a dibujar, no detrás: se midió que enterrarla al final
    de una descripción larga la debilita.
    """
    prompt = _IMAGE_STYLE_PREFIX + image_prompt
    if settings.google_api_key:
        try:
            return await _gemini_image(settings, prompt)
        except Exception as exc:  # noqa: BLE001 — para esto existen los respaldos
            logfire.warning("Gemini falló, probando Ideogram: {error}", error=str(exc))
    if settings.ideogram_api_key:
        try:
            return await _ideogram_image(settings, prompt)
        except Exception as exc:  # noqa: BLE001
            logfire.warning("Ideogram falló, usando gpt-image-1: {error}", error=str(exc))
    if settings.openai_api_key:
        return await _openai_image(settings, prompt)
    raise RuntimeError("No hay proveedor de imagen configurado (Gemini, Ideogram u OpenAI).")


async def illustrate(
    model: Model, settings: Settings, presentation: Presentation
) -> list[tuple[str, GeneratedIllustration]]:
    """Clasifica + genera ilustraciones para los núcleos que califican. Cacheado por documento."""
    _text, key = _cores_digest(presentation)
    if key in _cache:
        return _cache[key]
    if not has_image_provider(settings):
        raise RuntimeError(
            "Sin proveedor de imagen (IDEOGRAM_API_KEY u OPENAI_API_KEY): ilustraciones "
            "no disponibles."
        )

    plans = await _classify(model, presentation)
    by_id = {s.id: s for s in presentation.sections}
    out: list[tuple[str, GeneratedIllustration]] = []
    for plan in plans:
        data_uri = await _generate_image(settings, plan.image_prompt)
        section = by_id[plan.section_id]
        alt = f"Ilustración de apoyo sobre: {section.title or 'la sección'}"
        out.append((plan.section_id, GeneratedIllustration(image_url=data_uri, alt=alt)))
    _cache[key] = out
    return out
