"""A4 (Hito 5f) — Línea base de métricas con el modelo REAL. Arnés mínimo y reutilizable.

NO es la evaluación del Hito 8 (Pydantic Evals, Sonnet vs. Gemini): es la base sobre la que
esa se construirá. Corre pocos documentos por el pipeline real y reporta una tabla con:
  - validación al 1er intento vs. reintentos (nº de requests del modelo; clave con PromptedOutput),
  - latencia: a `start`, a la 1ª `section`, total,
  - tokens de entrada/salida (de result.usage()),
  - distribución core/satellite y si algún documento sale SIN núcleo (Punto 9),
  - resumen de grounding (verified/not_found/unverified) para entradas de texto.

Diseño para que el Hito 8 lo extienda sin rehacerlo: `measure_document()` (mide y devuelve un
`DocMetrics`) está separado de `render_table()` (reporta). No se usa Pydantic Evals aquí.

Uso:  uv run python scripts/metrics_baseline.py
No corre en CI ni en pytest. Requiere ANTHROPIC_API_KEY real. Escribe un CSV en scripts/outputs/.
"""

from __future__ import annotations

import asyncio
import csv
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from pydantic_ai.models import Model

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_model
from multimodal_presenter.pipeline.extraction import prepare_input
from multimodal_presenter.pipeline.streaming import SectionEmitter
from multimodal_presenter.pipeline.structuring import build_model_input, structuring_agent
from multimodal_presenter.pipeline.validation import verify_grounding

OUTPUT_DIR = Path(__file__).parent / "outputs"
LOCAL_FIXTURES = Path(__file__).parent.parent / "tests" / "fixtures" / "local"


@dataclass
class DocMetrics:
    name: str
    source_kind: str
    requests: int  # >1 sugiere reintentos de validación (con PromptedOutput es el dato clave)
    input_tokens: int
    output_tokens: int
    t_start_s: float
    t_first_section_s: float
    t_total_s: float
    n_sections: int
    n_core: int
    n_satellite: int
    has_core: bool
    grounding: str  # "verified/ not_found/ unverified" o "-" para binarios


def _usage_int(usage: object, *names: str) -> int:
    for name in names:
        value = getattr(usage, name, None)
        if isinstance(value, int):
            return value
    return 0


async def measure_document(
    model: Model,
    name: str,
    *,
    text: str | None = None,
    binary: bytes | None = None,
    media_type: str | None = None,
    filename: str | None = None,
) -> DocMetrics:
    """Corre UN documento por la Fase 2 (streaming) + Fase 3 (grounding) y mide."""
    extraction = prepare_input(text=text, binary=binary, media_type=media_type, filename=filename)
    emitter = SectionEmitter()
    t0 = time.monotonic()
    t_start = t_first = 0.0

    async with structuring_agent.run_stream(build_model_input(extraction), model=model) as result:
        async for partial in result.stream_output():
            if not t_start and getattr(partial, "title", None):
                t_start = time.monotonic() - t0
            if not t_first and emitter.take(partial, final=False):
                t_first = time.monotonic() - t0
        final = await result.get_output()
        usage = result.usage  # StreamedRunResult.usage es propiedad (RunUsage), no método
    t_total = time.monotonic() - t0
    if not t_first:
        # No hubo emisión a mitad de stream (p. ej. salida de 1 sola sección): la primera
        # sección aparece al final. Reportar == total es más honesto que 0.0.
        t_first = t_total

    presentation, grounding = verify_grounding(final, extraction)
    n_core = sum(1 for s in presentation.sections if s.role == "core")
    if extraction.source_kind == "text":
        g = (
            f"{grounding.verified_sections}/{grounding.not_found_sections}/"
            f"{grounding.unverified_sections}"
        )
    else:
        g = "-"

    return DocMetrics(
        name=name,
        source_kind=extraction.source_kind,
        requests=_usage_int(usage, "requests"),
        input_tokens=_usage_int(usage, "input_tokens", "request_tokens"),
        output_tokens=_usage_int(usage, "output_tokens", "response_tokens"),
        t_start_s=round(t_start, 2),
        t_first_section_s=round(t_first, 2),
        t_total_s=round(t_total, 2),
        n_sections=len(presentation.sections),
        n_core=n_core,
        n_satellite=len(presentation.sections) - n_core,
        has_core=n_core > 0,
        grounding=g,
    )


# Documentos de texto cortos y variados (pocos, para acotar costo).
TEXT_DOCS: list[tuple[str, str]] = [
    (
        "ventas_simple",
        "Andina Solar creció durante la última década. En 2022 vendió 100, en 2023 vendió 150 "
        "y en 2024 vendió 210. Los costos operativos rondaron el 60% de los ingresos.",
    ),
    (
        "cronologia",
        "La empresa se fundó en 2015. En 2018 abrió su primera planta. En 2021 exportó por "
        "primera vez. En 2024 alcanzó 200 empleados.",
    ),
    (
        "solo_prosa",
        "El informe describe los retos de la compañía sin cifras concretas: dependencia de "
        "proveedores externos, presión de la competencia y necesidad de diversificar mercados.",
    ),
]


def render_table(rows: list[DocMetrics]) -> str:
    header = (
        f"{'documento':16} {'tipo':6} {'req':>3} {'in_tok':>7} {'out_tok':>7} "
        f"{'t_start':>7} {'t_1sec':>7} {'t_tot':>7} {'secc':>4} {'core':>4} {'sat':>3} "
        f"{'sin_nucleo':>10} {'grounding(v/nf/u)':>17}"
    )
    lines = [header, "-" * len(header)]
    for r in rows:
        lines.append(
            f"{r.name:16} {r.source_kind:6} {r.requests:>3} {r.input_tokens:>7} "
            f"{r.output_tokens:>7} {r.t_start_s:>7} {r.t_first_section_s:>7} {r.t_total_s:>7} "
            f"{r.n_sections:>4} {r.n_core:>4} {r.n_satellite:>3} "
            f"{('SÍ' if not r.has_core else 'no'):>10} {r.grounding:>17}"
        )
    first_try = sum(1 for r in rows if r.requests <= 1)
    no_core = [r.name for r in rows if not r.has_core]
    lines.append("-" * len(header))
    lines.append(f"validación al 1er intento (req<=1): {first_try}/{len(rows)}")
    lines.append(f"documentos SIN núcleo: {no_core or 'ninguno'}")
    return "\n".join(lines)


async def main() -> None:
    model = build_model(get_settings())
    rows: list[DocMetrics] = []

    for name, text in TEXT_DOCS:
        rows.append(await measure_document(model, name, text=text))

    # PDF sintético discriminante (si el generador está disponible).
    try:
        import sys

        sys.path.insert(0, str(Path(__file__).parent.parent / "tests"))
        from synthetic_pdf import build_discriminant_pdf

        rows.append(
            await measure_document(
                model,
                "pdf_sintetico",
                binary=build_discriminant_pdf(),
                media_type="application/pdf",
            )
        )
    except Exception as exc:  # noqa: BLE001
        print(f"(saltado PDF sintético: {exc})")

    # PDFs reales aportados (si existen), pocos.
    if LOCAL_FIXTURES.exists():
        for pdf_path in sorted(LOCAL_FIXTURES.glob("*.pdf")):
            rows.append(
                await measure_document(
                    model,
                    pdf_path.stem[:16],
                    binary=pdf_path.read_bytes(),
                    media_type="application/pdf",
                )
            )

    table = render_table(rows)
    print("\n" + table + "\n")

    OUTPUT_DIR.mkdir(exist_ok=True)
    csv_path = OUTPUT_DIR / "metrics_baseline.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        for r in rows:
            writer.writerow(asdict(r))
    print(f"CSV -> {csv_path}")


if __name__ == "__main__":
    asyncio.run(main())
