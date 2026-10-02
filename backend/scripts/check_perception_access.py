"""Sonda mínima de acceso al modelo de percepción de audio (Fase 0, hallazgo A1).

Hace UNA llamada con UN clip corto y responde tres cosas antes de construir nada más encima:
  1. ¿Qué ruta quedó activa — Google AI Studio directo u OpenRouter?
  2. ¿El modelo devuelve un `AudioEvidence` válido contra el esquema?
  3. ¿Cuánto cuesta por minuto de audio? (tokens de entrada/salida reales de la llamada)

Si falla, imprime el error EXACTO del proveedor en vez de un mensaje genérico: con el historial
de bloqueos de acceso a Gemini de este proyecto, el texto literal del error es el dato útil.

Úsalo con un clip de prueba cualquiera (20-40 s), ANTES de grabar los 8 clips de la
mini-evaluación: si el acceso no funciona, grabar los 8 sería trabajo perdido.

Uso:
    uv run python scripts/check_perception_access.py ruta/al/clip.mp3

Requiere GOOGLE_API_KEY o, como contingencia, OPENROUTER_API_KEY en backend/.env.
No corre en CI ni en pytest.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from pydantic_ai import BinaryContent

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_perception_model
from multimodal_presenter.pipeline.perception import perception_agent
from multimodal_presenter.pipeline.uploads import (
    ALLOWED_MIME,
    audio_duration_seconds,
)

# Extensión → media_type canónico (el que esperan los modelos). `.m4a` y `.mp4` son el mismo
# contenedor y van a `audio/m4a`: es el formato por defecto de las grabadoras de celular.
MEDIA_TYPES = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".aiff": "audio/aiff",
    ".m4a": "audio/m4a",
    ".mp4": "audio/m4a",
}


def _usage_int(usage: object, *names: str) -> int:
    for name in names:
        value = getattr(usage, name, None)
        if isinstance(value, int):
            return value
    return 0


async def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if len(sys.argv) < 2:
        print(__doc__)
        print(f"Formatos admitidos: {', '.join(sorted(MEDIA_TYPES))}")
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"No existe el archivo: {path}")
        return 2
    media_type = MEDIA_TYPES.get(path.suffix.lower())
    if media_type is None or media_type not in ALLOWED_MIME:
        print(f"Extensión no admitida: {path.suffix}. Usa una de {', '.join(sorted(MEDIA_TYPES))}.")
        return 2

    audio = path.read_bytes()
    seconds = audio_duration_seconds(audio)
    settings = get_settings()

    # Qué ruta quedó activa. Se decide por qué clave hay; build_perception_model lanza si no hay
    # ninguna, con el mensaje que dice exactamente qué definir.
    try:
        model = build_perception_model(settings)
    except RuntimeError as exc:
        print(f"SIN PROVEEDOR\n\n{exc}")
        return 1

    if settings.google_api_key:
        ruta = f"Google AI Studio directo · {settings.google_perception_model}"
    else:
        ruta = f"OpenRouter · {settings.openrouter_perception_model}"

    print(f"Clip:  {path.name}  ({seconds:.1f} s, {len(audio) / 1024:.0f} KB, {media_type})")
    print(f"Ruta:  {ruta}")
    print("Llamando al modelo de percepción...\n")

    try:
        result = await perception_agent.run(
            [
                "Anota la evidencia acústica de este audio.",
                BinaryContent(data=audio, media_type=media_type),
            ],
            model=model,
        )
    except Exception as exc:  # noqa: BLE001 — aquí el error literal del proveedor ES el dato
        print(f"FALLÓ la ruta «{ruta}».\n")
        print(f"  Tipo:  {type(exc).__name__}")
        print(f"  Error: {exc}\n")
        if settings.google_api_key and not settings.openrouter_api_key:
            print(
                "Contingencia: define OPENROUTER_API_KEY en backend/.env y vuelve a correr "
                "esto. Si también falla, pásame los DOS errores literales antes de que "
                "intentemos un tercer proveedor."
            )
        elif not settings.google_api_key:
            print(
                "Esta era la ruta de contingencia (OpenRouter). Si la directa de Google "
                "también falló, pásame los dos errores literales."
            )
        return 1

    evidence = result.output
    # OJO: `usage` es una PROPIEDAD en pydantic-ai 2.46 (RunUsage), no un método — el mismo
    # detalle que ya estaba anotado en el arnés del 5f.
    usage = result.usage
    entrada = _usage_int(usage, "input_tokens", "request_tokens")
    salida = _usage_int(usage, "output_tokens", "response_tokens")

    print(f"FUNCIONÓ · ruta: {ruta}\n")
    print(f"  Hablantes detectados:  {evidence.speaker_count}")
    print(f"  Segmentos:             {len(evidence.segments)}")
    print(f"  Idioma:                {evidence.language}")
    print(f"  Calidad acústica:      {evidence.acoustic_context.quality}")
    print(f"  Eventos no verbales:   {len(evidence.non_verbal_events)}")
    print(f"  Cambios de tema:       {len(evidence.perceived_structure)}")
    enfasis = [frase for s in evidence.segments for frase in s.emphasis]
    print(f"  Frases con énfasis:    {len(enfasis)}  {enfasis[:3] if enfasis else ''}")
    dudosos = [s for s in evidence.segments if s.delivery == "dubitativo"]
    print(f"  Segmentos dubitativos: {len(dudosos)}")
    print(f"  Cifras/nombres en riesgo: {evidence.acoustic_context.at_risk_items}")

    print(f"\n  Tokens: {entrada} entrada / {salida} salida")
    if seconds > 0:
        por_min = entrada / (seconds / 60)
        print(f"  Tokens de entrada por minuto de audio: {por_min:.0f}")
        print(
            "  Para el costo por minuto: multiplica eso por la tarifa de entrada del modelo "
            "(el dashboard del proveedor da la cifra exacta de esta llamada)."
        )

    print("\n--- AudioEvidence completa ---")
    print(json.dumps(evidence.model_dump(mode="json"), ensure_ascii=False, indent=2))

    print(
        "\nRevisa arriba si lo que anotó COINCIDE con lo que de verdad se oye en tu clip. "
        "Que el esquema valide solo prueba que la llamada funciona; que la anotación sea fiel "
        "es lo que la mini-evaluación mide."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
