"""Fase 0: Percepción de audio (LLM con entrada acústica nativa).

Fase NUEVA y AISLADA: solo se activa para entradas de audio, antes del pipeline existente.
Para texto, PDF e imagen no se ejecuta y el flujo de las Fases 1-3 no cambia en absoluto.

    audio (BinaryContent) → agente de percepción (Gemini) → AudioEvidence (tipado)
                          → Fase 1 → Fase 2 (Sonnet, sin cambios) → Fase 3

Por qué existe: Claude Sonnet (el motor de estructuración) no admite audio como modalidad de
entrada en su API. La alternativa obvia (transcribir con un STT y pasar texto) aplana la
fuente antes de que cualquier modelo la interprete, que es justo lo que el principio rector
prohíbe y lo que el Hito 4 corrigió para PDF/imagen. Así que se delega SOLO la percepción a
un modelo que sí oye, y lo que entra a la Fase 2 es una representación estructurada
(`AudioEvidence`), no una transcripción plana.

Lo que NO se hizo (decisión cerrada, no reabrir): enrutar la estructuración completa del
audio a Gemini. Partiría la narrativa "Sonnet estructura" en dos motores con calidades
distintas: demasiado riesgo metodológico. La Fase 2 y su `FallbackModel` quedan intactos.

Modo de salida: `ToolOutput`. La percepción no se streamea (es un paso previo, no hay nada
que mostrar en vivo), así que conviene la garantía de esquema a nivel de proveedor; misma
elección que el juez semántico del 5a. El `PromptedOutput` de la Fase 2 no se toca.
"""

import logfire
from pydantic_ai import Agent, BinaryContent, ToolOutput
from pydantic_ai.models import Model

from ..schemas.audio import AudioEvidence, drop_unquoted_emphasis

PERCEPTION_PROMPT = """\
Eres un anotador de evidencia acústica. Recibes UN archivo de audio y produces una anotación \
estructurada de lo que REALMENTE se oye en la señal. No eres un transcriptor: la \
transcripción es solo una parte de tu salida.

Qué anotar:
- segments: divide el audio por turnos de habla y cambios claros. Para cada segmento: quién \
habla (etiqueta estable dentro de ESTE audio: "hablante 1", "hablante 2"; NO intentes \
identificar personas reales), el texto dicho, los segundos aproximados de inicio y fin, las \
frases con énfasis AUDIBLE (más volumen, tono marcado, alargamiento, separación silábica), \
la forma de decirlo (delivery) y si hubo pausa antes.
- emphasis: cada frase que anotes debe aparecer LITERALMENTE dentro del `text` de su \
segmento. Si no puedes copiarla literal, no la anotes.
- non_verbal_events: risas, suspiros, carraspeos, música, ruido, aplausos, silencios largos \
, solo si se oyen.
- acoustic_context: calidad de la grabación, ruido de fondo, y si eso pudo afectar la \
inteligibilidad. Si una cifra, nombre propio o sigla quedó dudosa POR EL AUDIO, enumérala \
en at_risk_items.
- speaker_count: cuántas voces distintas oyes.
- perceived_structure: cambios de tema marcados por la PROSODIA (pausa larga, cambio de tono \
o de ritmo), no por tu interpretación del contenido.
- language: el idioma que se habla.

Reglas de honestidad (son lo más importante de tu trabajo):
- Anota SOLO rasgos observables en la señal. No infieras emociones, intenciones, contexto, \
identidades ni datos que no se oigan.
- Ante la duda, baja la confidence a "baja" en vez de adivinar. Una anotación con confidence \
"baja" es útil; una anotación inventada con confidence "alta" corrompe todo el análisis.
- No "mejores" el habla: si alguien titubea, se corrige o deja una frase a medias, \
consérvalo en el texto tal como suena.
- Si no oyes énfasis, deja `emphasis` vacío. Si no hay eventos no verbales, deja la lista \
vacía. Una lista vacía es una respuesta correcta; rellenarla para parecer completo, no.
- Los tiempos son APROXIMADOS; no finjas precisión de milisegundos.\
"""

perception_agent = Agent(
    output_type=ToolOutput(AudioEvidence),
    system_prompt=PERCEPTION_PROMPT,
)


def is_audio(media_type: str | None) -> bool:
    """True si la fuente subida es audio (el único disparador de la Fase 0)."""
    return bool(media_type and media_type.startswith("audio/"))


async def run_perception(
    binary: bytes | None,
    media_type: str | None,
    perception_model: Model | None,
) -> AudioEvidence | None:
    """Ejecuta la Fase 0 si corresponde. Devuelve None para texto/PDF/imagen.

    Punto ÚNICO de decisión "¿esto es audio?" dentro del pipeline, compartido por el camino
    completo y el de streaming para que ambos entren a la Fase 1 con la misma evidencia
    (misma disciplina con la que el 5d refactorizó la Fase 3 a helpers por sección).
    """
    if not is_audio(media_type) or binary is None:
        return None
    if perception_model is None:
        raise RuntimeError("una fuente de audio exige el modelo de percepción (Fase 0)")
    assert media_type is not None
    return await perceive_audio(binary, media_type, perception_model)


async def perceive_audio(audio: bytes, media_type: str, model: Model) -> AudioEvidence:
    """Fase 0: pide al modelo acústico la anotación estructurada del audio.

    El audio viaja como `BinaryContent` nativo, el mismo mecanismo con el que el PDF y la
    imagen llegan a la Fase 2 desde el Hito 4. Nunca se transcribe primero.
    """
    with logfire.span("fase0.percepcion", media_type=media_type, bytes=len(audio)):
        result = await perception_agent.run(
            [
                "Anota la evidencia acústica de este audio.",
                BinaryContent(data=audio, media_type=media_type),
            ],
            model=model,
        )
        evidence, dropped = drop_unquoted_emphasis(result.output)
        if dropped:
            # Se traza, no se oculta: una marca de énfasis que el modelo no puede citar de su
            # propia transcripción no es observable, así que se cae (ver schemas/audio.py).
            logfire.info(
                "percepcion: {n} marca(s) de énfasis descartada(s) por no ser literales",
                n=len(dropped),
                dropped=dropped,
            )
        return evidence
