"""Ilustraciones de apoyo GENERADAS (Hito 5h Parte 1).

Reapertura acotada de una decisión de Fase 2: se genera una ilustración SOLO cuando (1) la sección
no tiene imagen real del documento (a nivel de documento: solo fuentes de texto, que no traen
imágenes), (2) el contenido se beneficia genuinamente de apoyo visual (proceso físico, mecanismo
espacial o secuencia visual — rúbrica fija, no juicio libre), y (3) es ayuda didáctica, nunca
prueba (estructuralmente: `GeneratedIllustration` no tiene `source`). Etiqueta obligatoria siempre.

Flujo: un clasificador barato (Haiku) decide qué núcleos califican y da un prompt de imagen; luego
se genera la imagen con OpenAI gpt-image-1 (calidad media). Cacheado por documento. Techo de
seguridad para acotar el costo. La condición 1 (solo texto) la aplica el frontend al decidir si
llama a este flujo.
"""

from __future__ import annotations

import hashlib

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
# El estilo busca imágenes que EXPLIQUEN, no íconos vagos: detalladas, con etiquetas de texto y
# relaciones visibles, de modo que se entienda qué representan sin leer el texto de la slide.
_IMAGE_STYLE = (
    " Estilo: diagrama educativo claro y DETALLADO que EXPLIQUE el concepto. Incluye ETIQUETAS de "
    "texto cortas y correctas (en español) sobre los elementos clave, y flechas que muestren el "
    "flujo o las relaciones. Composición ordenada, fondo claro, alta legibilidad. NO un ícono "
    "abstracto ni meramente decorativo: al verlo debe quedar claro qué representa y por qué."
)


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
    "concepto: nombra los elementos a dibujar, cómo se relacionan o fluyen, y qué etiquetas poner, "
    "de modo que la imagen clarifique por sí sola (nunca un ícono vago). Devuelve SOLO las "
    "secciones que califican (puede ser ninguna)."
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


async def _generate_image(settings: Settings, image_prompt: str) -> str:
    """Genera la imagen con gpt-image-1 (calidad media) y la devuelve como data URI."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.images.generate(
        model=settings.openai_image_model,
        prompt=image_prompt + _IMAGE_STYLE,
        size="1024x1024",
        quality=settings.openai_image_quality,
        n=1,
    )
    b64 = response.data[0].b64_json
    return f"data:image/png;base64,{b64}"


async def illustrate(
    model: Model, settings: Settings, presentation: Presentation
) -> list[tuple[str, GeneratedIllustration]]:
    """Clasifica + genera ilustraciones para los núcleos que califican. Cacheado por documento."""
    _text, key = _cores_digest(presentation)
    if key in _cache:
        return _cache[key]
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY no configurada: las ilustraciones no están disponibles.")

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
