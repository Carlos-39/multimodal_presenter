"""Narración tipo audiolibro (Hito 5g Parte 3).

Dos pasos, bajo demanda y cacheados por documento:
1. GUION (Sonnet): una síntesis hablada del contenido, con su propio hilo narrativo — NO una
   transcripción del texto en pantalla. Narra los NÚCLEOS como columna vertebral y menciona que
   hay más detalle en modo detallado. Coherente con el Punto 2 (la redundancia texto+audio solo se
   permite en casos verificables, que no aplican aquí) y con "resumen primero, detalle a un clic".
2. VOZ (OpenAI tts-1): sintetiza el guion a audio (mp3).

Caché en memoria por proceso, con clave = hash del contenido de la presentación: pedir la misma
narración otra vez NO regenera (ni guion ni audio). Si el TTS falla, se propaga el error para que
el frontend lo muestre (honestidad); nunca un reproductor mudo sin explicación.
"""

from __future__ import annotations

import hashlib

import truststore
from pydantic_ai import Agent
from pydantic_ai.models import Model

from ..config import Settings
from ..schemas.presentation import (
    ChartContent,
    Presentation,
    Section,
    TableContent,
    TextContent,
    TimelineContent,
)

truststore.inject_into_ssl()  # SSL del sistema (Windows), igual que model_provider

_TTS_MAX_CHARS = 4096  # límite de entrada de tts-1

_SCRIPT_SYSTEM = (
    "Eres un narrador. A partir de una presentación ya estructurada, escribe un GUION hablado "
    "para escuchar como un audiolibro: una síntesis coherente y con hilo propio, NO una lectura "
    "literal de las secciones ni una transcripción. Usa los núcleos como columna vertebral del "
    "relato y, de forma natural, menciona que hay más detalle disponible en el modo detallado "
    "para quien quiera profundizar. Es un PANORAMA escuchable de entre 250 y 500 palabras, sin "
    "importar el tamaño del documento (una síntesis, no un recuento exhaustivo). Español neutro y "
    "claro, pensado para el oído. Sin fórmulas de cuento infantil, sin 'bienvenidos', sin leer "
    "URLs ni fórmulas matemáticas en voz alta. Devuelve solo el guion."
)

script_agent = Agent(system_prompt=_SCRIPT_SYSTEM)

# Cachés por proceso (clave = hash del contenido). Acotadas: pocas sesiones de evaluación.
_script_cache: dict[str, str] = {}
_audio_cache: dict[str, bytes] = {}


def _content_text(content: object) -> str:
    """Texto breve de una sección: materia prima del guion, no lo que se narra literalmente."""
    if isinstance(content, TextContent):
        return content.text
    if isinstance(content, TableContent):
        cols = ", ".join(content.columns)
        return f"[tabla con columnas {cols} y {len(content.rows)} filas]"
    if isinstance(content, ChartContent):
        cats = ", ".join(content.data.categories)
        return f"[gráfico {content.chart_type} sobre {cats}]"
    if isinstance(content, TimelineContent):
        return f"[línea de tiempo con {len(content.events)} eventos]"
    return ""


def _digest(presentation: Presentation) -> tuple[str, str]:
    """Devuelve (texto de los núcleos para el guion, clave de caché estable por contenido)."""
    cores: list[Section] = [s for s in presentation.sections if s.role == "core"]
    if not cores:  # si no hubiera núcleos, usar todas (nunca narrar vacío)
        cores = list(presentation.sections)
    parts = [presentation.title, ""]
    for s in cores:
        parts.append(f"{s.title or ''}: {_content_text(s.content)}".strip())
    text = "\n\n".join(parts)
    key = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return text, key


async def generate_script(model: Model, presentation: Presentation) -> str:
    """Genera (o recupera de caché) el guion narrativo de los núcleos."""
    text, key = _digest(presentation)
    if key in _script_cache:
        return _script_cache[key]
    result = await script_agent.run(text, model=model)
    script = result.output.strip()[:_TTS_MAX_CHARS]
    _script_cache[key] = script
    return script


async def synthesize_speech(settings: Settings, script: str) -> bytes:
    """Sintetiza el guion a audio (mp3) con OpenAI tts-1. Lanza si falta la clave o falla el TTS."""
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY no configurada: la narración TTS no está disponible.")
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.audio.speech.create(
        model=settings.openai_tts_model,
        voice=settings.openai_tts_voice,
        input=script,
    )
    return response.content


async def narrate(model: Model, presentation: Presentation, settings: Settings) -> bytes:
    """Flujo completo: guion (cacheado) → audio (cacheado). Devuelve mp3. On-demand."""
    _text, key = _digest(presentation)
    if key in _audio_cache:
        return _audio_cache[key]
    script = await generate_script(model, presentation)
    audio = await synthesize_speech(settings, script)
    _audio_cache[key] = audio
    return audio
