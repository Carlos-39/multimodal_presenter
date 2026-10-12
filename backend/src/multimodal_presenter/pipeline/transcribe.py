"""Transcripción de voz a texto para la caja del chat (entrada por voz).

OpenAI `gpt-4o-mini-transcribe` (misma clave que el TTS del 5g). SOLO convierte audio→texto para
que el usuario lo revise y lo envíe si quiere: NUNCA interpreta comandos ni envía nada por su
cuenta. Si falla, se propaga el error para que el frontend lo muestre (honestidad), nunca en
silencio ni insertando texto vacío.
"""

from __future__ import annotations

import truststore

from ..config import Settings

truststore.inject_into_ssl()  # SSL del sistema (Windows), igual que model_provider


async def transcribe_audio(settings: Settings, audio: bytes, filename: str) -> str:
    """Transcribe el audio a texto (español). Lanza si falta la clave o falla el proveedor."""
    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY no configurada: la transcripción de voz no está disponible."
        )
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.audio.transcriptions.create(
        model=settings.openai_transcribe_model,
        file=(filename or "audio.webm", audio),
        language="es",  # la evaluación es en español: mejora precisión y latencia
    )
    return (response.text or "").strip()
