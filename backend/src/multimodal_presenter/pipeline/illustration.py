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
# Opción 2: la imagen NO lleva texto (las etiquetas/explicación van en la slide). El dibujo debe
# explicar por sí mismo con formas, colores, flechas y composición — sin palabras dentro.
_IMAGE_STYLE = (
    " Estilo: ilustración educativa clara y DETALLADA que explique el concepto mediante formas, "
    "colores, flechas y composición. SIN NINGÚN TEXTO, palabra, número ni etiqueta dentro de la "
    "imagen (las explicaciones van aparte). Fondo claro, limpio, alta legibilidad visual; no un "
    "ícono abstracto ni meramente decorativo."
)


def has_image_provider(settings: Settings) -> bool:
    """¿Hay con qué generar imágenes? (Ideogram primario u OpenAI de fallback)."""
    return bool(settings.ideogram_api_key or settings.openai_api_key)


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
    "marcada, da un `image_prompt` en español DETALLADO que describa un diagrama que EXPLIQUE el "
    "concepto SOLO con elementos visuales: nombra los objetos a dibujar y cómo se relacionan o "
    "fluyen (flechas, posición, color). NO pidas texto ni etiquetas dentro de la imagen (eso va en "
    "la slide). Devuelve SOLO las secciones que califican (puede ser ninguna)."
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
    """Genera la imagen (sin texto) como data URI: Ideogram primario, gpt-image-1 de fallback."""
    prompt = image_prompt + _IMAGE_STYLE
    if settings.ideogram_api_key:
        try:
            return await _ideogram_image(settings, prompt)
        except Exception as exc:  # noqa: BLE001 — el fallback es justamente para esto
            logfire.warning("Ideogram falló, usando gpt-image-1: {error}", error=str(exc))
    if settings.openai_api_key:
        return await _openai_image(settings, prompt)
    raise RuntimeError("No hay proveedor de imagen configurado (Ideogram u OpenAI).")


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
