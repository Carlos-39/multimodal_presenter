"""Mini-evaluación de la entrada de audio (hallazgo A1) — dos condiciones, modelo REAL.

Compara, sobre los mismos clips y con el MISMO estructurador (Sonnet) y el mismo contrato:

  (a) `transcripcion` — línea base: STT (`gpt-4o-mini-transcribe`) → texto plano → Sonnet.
      Es la vía que CONTRADICE el principio de no aplanar; está aquí para medirla, no para
      proponerla.
  (b) `percepcion`   — la nueva: audio → Gemini → `AudioEvidence` → Sonnet.

Lo único que cambia entre condiciones es la representación intermedia. Si no hay diferencia,
el resultado es que no hay diferencia: la investigación previa ya advierte que para contenido
informativo la diferencia probablemente sea marginal, y este arnés existe para cuantificarla,
no para confirmarla.

Las tres medidas son DETERMINISTAS (sin juez LLM, a diferencia del Hito 7) porque lo que se
pregunta es verificable por presencia de texto, y un juez añadiría varianza sin añadir
información:
  - `enfasis_en_nucleo`  — ¿la frase que se dijo con énfasis quedó en una sección núcleo o en
    el título? (contra `enfasis_en` del manifiesto)
  - `duda_matizada`      — ¿la cifra dicha con duda aparece con una marca de incertidumbre, y
    la cifra firme NO? Las dos mitades importan: matizarlo todo no es acertar.
  - `hablantes_citados`  — ¿cuántos hablantes distintos se mencionan? (solo clips de 2 voces)
Más el costo real por minuto de audio, que es lo que decide si esto es sostenible.

Uso:
    uv run python scripts/eval_audio_evidence.py
No corre en CI ni en pytest. Requiere los clips grabados en tests/fixtures/local/audio/
(ver docs/Guion_Clips_Audio_A1.md), ANTHROPIC_API_KEY, OPENAI_API_KEY (línea base) y
GOOGLE_API_KEY u OPENROUTER_API_KEY (percepción). Escribe CSV y JSONL en scripts/outputs/.
"""

from __future__ import annotations

import asyncio
import csv
import json
import sys
import time
import unicodedata
from dataclasses import asdict, dataclass, field
from pathlib import Path

from pydantic_ai.models import Model

from multimodal_presenter.config import Settings, get_settings
from multimodal_presenter.model_provider import build_model, build_perception_model
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.perception import perceive_audio
from multimodal_presenter.pipeline.structuring import structure_document
from multimodal_presenter.pipeline.transcribe import transcribe_audio
from multimodal_presenter.pipeline.uploads import audio_duration_seconds
from multimodal_presenter.schemas import Presentation
from multimodal_presenter.schemas.audio import AudioEvidence

HERE = Path(__file__).parent
OUTPUT_DIR = HERE / "outputs"
MANIFEST = HERE / "audio_clips_manifest.json"
CLIPS_DIR = HERE.parent / "tests" / "fixtures" / "local" / "audio"

MEDIA_TYPES = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".aiff": "audio/aiff",
}

# Marcas de incertidumbre. Lista fija y revisable: la medida tiene que ser reproducible, así
# que se declara explícitamente en vez de dejarla a juicio de un modelo.
HEDGES = (
    "aproximadamente",
    "alrededor de",
    "cerca de",
    "unos ",
    "unas ",
    "más o menos",
    "no confirmad",
    "sin confirmar",
    "por confirmar",
    "estimad",
    "aproximad",
    "incierto",
    "incierta",
    "no precis",
    "según el hablante",
    "no está seguro",
    "no estaba seguro",
    "duda",
    "dudos",
    "habría que confirmar",
    "no se oye",
    "no se escuch",
    "inaudible",
    "no se entiende",
    "poco clar",
    "no verificad",
)


def _norm(text: str) -> str:
    """Minúsculas sin tildes: el modelo escribe 'retencion' o 'retención' indistintamente."""
    stripped = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in stripped if unicodedata.category(c) != "Mn")


def _contains_any(haystack: str, variants: list[str]) -> bool:
    """True si alguna variante de superficie aparece ('42 %' vs 'cuarenta y dos por ciento')."""
    hay = _norm(haystack)
    return any(_norm(v) in hay for v in variants)


def _section_texts(presentation: Presentation) -> list[tuple[str, str]]:
    """(rol, texto completo) por sección, aplanando cualquier tipo de contenido del contrato."""
    out: list[tuple[str, str]] = []
    for section in presentation.sections:
        parts = [section.title or ""]
        content = section.content
        kind = content.content_type
        if kind == "text":
            parts.append(content.text)
        elif kind == "table":
            parts.extend(content.columns)
            parts.extend(str(cell) for row in content.rows for cell in row)
        elif kind == "timeline":
            parts.extend(f"{e.date} {e.label} {e.description or ''}" for e in content.events)
        elif kind == "chart":
            parts.extend(content.data.categories)
            parts.extend(s.name for s in content.data.series)
        out.append((section.role.value, " ".join(parts)))
    return out


def _hedged_near(text: str, figure: list[str]) -> bool:
    """¿La cifra aparece en una frase que también lleva una marca de incertidumbre?

    Se mira por FRASE, no por documento: 'el presupuesto fue aproximadamente X. El personal
    costó Y exactos' no debe contar como que Y está matizado.
    """
    for sentence in _norm(text).replace("\n", ". ").split("."):
        if any(_norm(v) in sentence for v in figure):
            if any(h in sentence for h in HEDGES):
                return True
    return False


@dataclass
class Measured:
    clip: str
    condicion: str
    n_secciones: int
    n_nucleos: int
    enfasis_en_nucleo: bool | None  # None si el clip no diseñó énfasis
    duda_matizada: bool | None  # None si el clip no diseñó una cifra dudosa
    firme_no_matizada: bool | None  # la otra mitad: no matizar lo que sí era firme
    hablantes_citados: int | None  # None si el clip es de un solo hablante
    titulo: str
    latencia_s: float
    input_tokens: int
    output_tokens: int
    audio_s: float
    notas: list[str] = field(default_factory=list)


def _usage_int(usage: object, *names: str) -> int:
    for name in names:
        value = getattr(usage, name, None)
        if isinstance(value, int):
            return value
    return 0


def measure(clip: dict, condicion: str, presentation: Presentation, audio_s: float) -> Measured:
    """Aplica las tres medidas a la presentación resultante. Determinista, sin LLM."""
    sections = _section_texts(presentation)
    todo = " ".join(text for _role, text in sections) + " " + presentation.title
    nucleo = " ".join(text for role, text in sections if role == "core") + " " + presentation.title

    enfasis = clip.get("enfasis_en") or []
    enfasis_ok: bool | None = None
    if enfasis:
        enfasis_ok = all(_contains_any(nucleo, variants) for variants in enfasis)

    dudosa = clip.get("cifra_dudosa")
    duda_ok: bool | None = _hedged_near(todo, dudosa) if dudosa else None

    firmes = clip.get("cifra_firme") or []
    firme_ok: bool | None = None
    if dudosa and firmes:
        # Acierta si NINGUNA cifra firme quedó matizada: matizarlo todo no es captar la duda.
        firme_ok = not any(_hedged_near(todo, variants) for variants in firmes)

    hablantes: int | None = None
    if clip.get("hablantes", 1) > 1:
        hay = _norm(todo)
        hablantes = sum(
            1
            for n in (
                "hablante 1",
                "hablante 2",
                "primer hablante",
                "segundo hablante",
                "voz a",
                "voz b",
            )
            if n in hay
        )
        hablantes = min(hablantes, clip["hablantes"]) if hablantes else 0

    return Measured(
        clip=clip["id"],
        condicion=condicion,
        n_secciones=len(presentation.sections),
        n_nucleos=sum(1 for role, _ in sections if role == "core"),
        enfasis_en_nucleo=enfasis_ok,
        duda_matizada=duda_ok,
        firme_no_matizada=firme_ok,
        hablantes_citados=hablantes,
        titulo=presentation.title,
        latencia_s=0.0,
        input_tokens=0,
        output_tokens=0,
        audio_s=round(audio_s, 1),
    )


async def run_baseline(
    clip: dict, audio: bytes, settings: Settings, model: Model, audio_s: float
) -> tuple[Measured, str]:
    """Condición (a): STT → texto plano → Sonnet. La vía que aplana la fuente."""
    t0 = time.monotonic()
    transcript = await transcribe_audio(settings, audio, clip["archivo"])
    extraction = prepare_input(text=transcript)
    presentation = await structure_document(extraction, model)
    out = measure(clip, "transcripcion", presentation, audio_s)
    out.latencia_s = round(time.monotonic() - t0, 2)
    return out, transcript


async def run_perception(
    clip: dict, audio: bytes, media_type: str, model: Model, perception: Model, audio_s: float
) -> tuple[Measured, AudioEvidence]:
    """Condición (b): audio → AudioEvidence → Sonnet. La fase de percepción."""
    t0 = time.monotonic()
    evidence = await perceive_audio(audio, media_type, perception)
    extraction = prepare_input(
        binary=audio, media_type=media_type, filename=clip["archivo"], audio_evidence=evidence
    )
    presentation = await structure_document(extraction, model)
    out = measure(clip, "percepcion", presentation, audio_s)
    out.latencia_s = round(time.monotonic() - t0, 2)
    return out, evidence


def _fmt(value: bool | int | None) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, bool):
        return "sí" if value else "NO"
    return str(value)


def render_table(rows: list[Measured]) -> str:
    head = [
        "clip",
        "condición",
        "secc",
        "núcl",
        "énfasis→núcleo",
        "duda matizada",
        "firme intacta",
        "hablantes",
        "lat_s",
        "audio_s",
    ]
    lines = [" | ".join(head), "|".join("-" * (len(h) + 2) for h in head)]
    for r in rows:
        lines.append(
            " | ".join(
                [
                    r.clip,
                    r.condicion,
                    str(r.n_secciones),
                    str(r.n_nucleos),
                    _fmt(r.enfasis_en_nucleo),
                    _fmt(r.duda_matizada),
                    _fmt(r.firme_no_matizada),
                    _fmt(r.hablantes_citados),
                    f"{r.latencia_s}",
                    f"{r.audio_s}",
                ]
            )
        )
    return "\n".join(lines)


def _ratio(subset: list[Measured], attr: str) -> str:
    """ "aciertos/aplicables" de una medida booleana, ignorando los clips donde no aplica."""
    vals = [getattr(r, attr) for r in subset if getattr(r, attr) is not None]
    return f"{sum(1 for v in vals if v)}/{len(vals)}" if vals else "n/a"


def render_summary(rows: list[Measured]) -> str:
    """Agregado por condición. Solo cuenta los clips donde la medida APLICA (no los n/a)."""
    out = ["", "Resumen por condición (solo clips donde la medida aplica):"]
    for condicion in ("transcripcion", "percepcion"):
        subset = [r for r in rows if r.condicion == condicion]
        if not subset:
            continue
        dobles = [r for r in subset if r.hablantes_citados is not None]
        ambos = sum(1 for r in dobles if (r.hablantes_citados or 0) >= 2)
        out.append(
            f"  {condicion:14s} énfasis→núcleo {_ratio(subset, 'enfasis_en_nucleo')} · "
            f"duda matizada {_ratio(subset, 'duda_matizada')} · "
            f"firme intacta {_ratio(subset, 'firme_no_matizada')} · "
            f"ambos hablantes {ambos}/{len(dobles) if dobles else 0}"
        )
    return "\n".join(out)


async def main() -> None:
    # La consola de Windows suele ser cp1252 y revienta con los acentos y las flechas del
    # reporte. Mismo criterio que el arnés del Hito 7 y el exportador de telemetría.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    settings = get_settings()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    clips = manifest["clips"]

    faltantes = [c["archivo"] for c in clips if not (CLIPS_DIR / c["archivo"]).exists()]
    if faltantes:
        print(f"Faltan clips en {CLIPS_DIR}:")
        for f in faltantes:
            print(f"  - {f}")
        print("\nGrábalos siguiendo docs/Guion_Clips_Audio_A1.md y vuelve a correr esto.")
        return

    model = build_model(settings)
    perception = build_perception_model(settings)

    rows: list[Measured] = []
    traza: list[dict] = []
    for clip in clips:
        path = CLIPS_DIR / clip["archivo"]
        audio = path.read_bytes()
        media_type = MEDIA_TYPES[path.suffix.lower()]
        audio_s = audio_duration_seconds(audio)
        print(f"· {clip['id']} ({audio_s:.1f}s)")

        base, transcript = await run_baseline(clip, audio, settings, model, audio_s)
        perc, evidence = await run_perception(clip, audio, media_type, model, perception, audio_s)
        rows.extend([base, perc])
        traza.append(
            {
                "clip": clip["id"],
                "esperado": clip["esperado"],
                "transcripcion": transcript,
                "audio_evidence": evidence.model_dump(mode="json"),
                "titulo_transcripcion": base.titulo,
                "titulo_percepcion": perc.titulo,
            }
        )

    table = render_table(rows)
    print("\n" + table)
    print(render_summary(rows))

    total_audio_min = sum(r.audio_s for r in rows if r.condicion == "percepcion") / 60
    print(f"\nAudio procesado: {total_audio_min:.2f} min en {len(clips)} clips.")
    print("Costo: tómalo del dashboard de cada proveedor (Logfire traza las llamadas por fase).")

    OUTPUT_DIR.mkdir(exist_ok=True)
    csv_path = OUTPUT_DIR / "eval_audio_evidence.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        for r in rows:
            writer.writerow(asdict(r))
    jsonl_path = OUTPUT_DIR / "eval_audio_evidence.jsonl"
    with jsonl_path.open("w", encoding="utf-8") as fh:
        for item in traza:
            fh.write(json.dumps(item, ensure_ascii=False) + "\n")
    print(f"CSV   -> {csv_path}\nJSONL -> {jsonl_path}  (transcripción y evidencia completas)")


if __name__ == "__main__":
    asyncio.run(main())
