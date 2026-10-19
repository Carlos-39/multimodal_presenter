"""Tests de integración con el modelo REAL (Anthropic claude-sonnet-5), opcionales, solo local.

No corren en CI ni por defecto: se saltan si no hay ANTHROPIC_API_KEY real. Para ejecutarlos:
    uv run pytest -m integration

Filosofía (Hito 5f): si el modelo real falla una verificación, es un HALLAZGO, no un test que
haya que ajustar para que pase. Se aserta solo lo objetivo y estable; lo probabilístico o
descriptivo se imprime como reporte.
"""

from __future__ import annotations

import asyncio
import io
import sys
from pathlib import Path

import pytest
from pypdf import PdfReader, PdfWriter

from multimodal_presenter.config import get_settings
from multimodal_presenter.model_provider import build_model
from multimodal_presenter.pipeline import transform
from multimodal_presenter.pipeline.models import ExtractionResult
from multimodal_presenter.pipeline.validation import verify_semantic_coherence
from multimodal_presenter.schemas import Presentation
from multimodal_presenter.schemas.presentation import (
    ChartContent,
    ChartData,
    ChartSeries,
    Section,
    SourceReference,
)

# La consola de Windows (cp1252) no codifica algunos caracteres del contenido real (p. ej. del
# IPCC en español); sin esto, un print del reporte crashea. errors="replace" lo hace robusto.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
except (AttributeError, ValueError):
    pass

sys.path.insert(0, str(Path(__file__).parent))
from synthetic_pdf import (  # noqa: E402
    CHART_VALUES,
    TABLE_ROWS,
    build_discriminant_pdf,
)

_key = get_settings().anthropic_api_key
_HAS_REAL_KEY = bool(_key) and _key != "your-anthropic-api-key-here"
_needs_key = pytest.mark.skipif(
    not _HAS_REAL_KEY, reason="requiere ANTHROPIC_API_KEY real (solo local)"
)

LOCAL_FIXTURES = Path(__file__).parent / "fixtures" / "local"


def _all_values_text(presentation: Presentation) -> str:
    """Serializa la presentación a JSON: base para buscar qué cifras capturó el modelo."""
    return presentation.model_dump_json()


# ─────────────────────────────────────────────────────────────
# A1: PDF nativo: prueba DISCRIMINANTE
# ─────────────────────────────────────────────────────────────
@pytest.mark.integration
@_needs_key
def test_a1_pdf_native_reads_rasterized_chart() -> None:
    """DISCRIMINANTE: el modelo debe recuperar valores del gráfico RASTERIZADO que pypdf pierde.

    Control (mismo PDF, camino aplanado del PoC): pypdf NO extrae los valores del gráfico.
    Pipeline nativo (Sonnet ve la imagen): SÍ debe recuperarlos. Mismo documento, dos caminos.
    """
    pdf = build_discriminant_pdf()
    chart_nums = [str(v) for v in CHART_VALUES]
    table_nums = [str(v) for _, v in TABLE_ROWS]

    # Control/baseline (NUNCA en el pipeline): reproduce el aplanado del PoC.
    reader = PdfReader(io.BytesIO(pdf))
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    baseline_chart = {n: (n in extracted) for n in chart_nums}
    assert not any(baseline_chart.values()), (
        f"El fixture no es discriminante: pypdf extrajo valores del gráfico {baseline_chart}"
    )

    # Pipeline real: el binario llega nativo al modelo (sin OCR/pypdf).
    result = asyncio.run(
        transform(
            model=build_model(get_settings()),
            binary=pdf,
            media_type="application/pdf",
            filename="andina.pdf",
        )
    )
    out = _all_values_text(result.presentation)

    chart_hit = {n: (n in out) for n in chart_nums}
    table_hit = {n: (n in out) for n in table_nums}
    pages = [e.page for e in result.grounding.sections]

    print("\n=== A1 · PDF nativo (discriminante) ===")
    print(f"pypdf (aplanado) capturó del gráfico: {baseline_chart}  (esperado: todo False)")
    print(f"Sonnet (nativo)  capturó del gráfico: {chart_hit}")
    print(f"Sonnet (nativo)  capturó de la tabla: {table_hit}")
    print(f"secciones: {[s.content.content_type for s in result.presentation.sections]}")
    print(f"grounding source_kind={result.grounding.source_kind} pages={pages}")
    print(result.presentation.model_dump_json(indent=2))

    # Aserciones (cifras exactas, redacción libre):
    assert result.grounding.source_kind == "pdf"
    assert result.grounding.unverified_sections == len(result.presentation.sections)
    assert any(p is not None for p in pages), "ninguna sección trae source.page (contrato 5c/PDF)"
    # DISCRIMINANTE: la mayoría de los valores del gráfico rasterizado deben aparecer.
    assert sum(chart_hit.values()) >= 3, f"el modelo NO leyó el gráfico rasterizado: {chart_hit}"
    # Prueba de que también leyó la tabla (texto real).
    assert sum(table_hit.values()) >= 3, f"el modelo NO leyó la tabla: {table_hit}"


# ─────────────────────────────────────────────────────────────
# A1 (humo): PDFs reales aportados (si existen): reporta, NO aserta cifras
# ─────────────────────────────────────────────────────────────
# Los PDFs reales pueden ser largos (y Anthropic limita a 100 páginas). Se recorta a las
# primeras N páginas: acota el costo de tokens y respeta el acuerdo de "usar pocas páginas".
SMOKE_MAX_PAGES = 8


def _local_pdfs() -> list[Path]:
    if not LOCAL_FIXTURES.exists():
        return []
    return sorted(p for p in LOCAL_FIXTURES.glob("*.pdf"))


def _excerpt_first_pages(data: bytes, max_pages: int) -> tuple[bytes, int, int]:
    """Recorta a las primeras `max_pages`. Devuelve (bytes, páginas_enviadas, páginas_totales)."""
    reader = PdfReader(io.BytesIO(data))
    total = len(reader.pages)
    if total <= max_pages:
        return data, total, total
    writer = PdfWriter()
    for i in range(max_pages):
        writer.add_page(reader.pages[i])
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue(), max_pages, total


@pytest.mark.integration
@_needs_key
@pytest.mark.parametrize("pdf_path", _local_pdfs(), ids=lambda p: p.name)
def test_a1_real_pdf_smoke(pdf_path: Path) -> None:
    """Humo con PDFs reales aportados: reporta secciones/tipos/página; sin asertar cifras."""
    data, sent, total = _excerpt_first_pages(pdf_path.read_bytes(), SMOKE_MAX_PAGES)
    result = asyncio.run(
        transform(
            model=build_model(get_settings()),
            binary=data,
            media_type="application/pdf",
            filename=pdf_path.name,
        )
    )
    types = [s.content.content_type for s in result.presentation.sections]
    print(f"\n=== A1 humo · {pdf_path.name} ({sent}/{total} pág, {len(data) // 1024} KB) ===")
    print(f"secciones={len(result.presentation.sections)} tipos={types}")
    print(f"títulos={[s.title for s in result.presentation.sections]}")
    print(f"grounding pages={[e.page for e in result.grounding.sections]}")
    print(result.presentation.model_dump_json(indent=2))
    assert isinstance(result.presentation, Presentation)
    assert result.grounding.source_kind == "pdf"


# ─────────────────────────────────────────────────────────────
# A2: Verificación semántica de gráficos (juez real, probabilístico)
# ─────────────────────────────────────────────────────────────
A2_SOURCE = (
    "Informe de ventas de Andina Solar. Las ventas anuales fueron 100 en 2022, "
    "150 en 2023 y 210 en 2024. No se dispone de proyecciones para años futuros."
)
A2_REPS = 3

# (nombre, categorías, valores, ¿debe marcarse?)
A2_CASES: list[tuple[str, list[str], list[float], bool]] = [
    ("a_fiel", ["2022", "2023", "2024"], [100, 150, 210], False),
    ("b_cifra_alterada", ["2022", "2023", "2024"], [100, 150, 320], True),
    ("c_no_respaldado", ["2022", "2023", "2024", "2025"], [100, 150, 210, 300], True),
]


def _chart_presentation(categories: list[str], values: list[float]) -> Presentation:
    return Presentation(
        title="Ventas de Andina Solar",
        sections=[
            Section(
                id="c1",
                role="core",
                source=SourceReference(document_id="d", quote="ventas anuales"),
                content=ChartContent(
                    chart_type="bar",
                    data=ChartData(
                        categories=categories,
                        series=[ChartSeries(name="Ventas (millones COP)", values=values)],
                    ),
                ),
            )
        ],
    )


@pytest.mark.integration
@_needs_key
def test_a2_semantic_judge_matrix() -> None:
    """Juez semántico contra casos con veredicto conocido, con repeticiones (es probabilístico).

    Aserta lo esencial (el caso 'b' se marca en la mayoría); reporta la matriz completa y las
    tasas de falsos positivos/negativos SIN ocultarlas.
    """
    model = build_model(get_settings())
    extraction = ExtractionResult(source_kind="text", document_id="d", text=A2_SOURCE)

    matrix: dict[str, list[bool]] = {}
    print("\n=== A2 · Juez semántico (caso × corrida) ===")
    for name, categories, values, _should in A2_CASES:
        presentation = _chart_presentation(categories, values)
        runs: list[bool] = []
        for rep in range(A2_REPS):
            report = asyncio.run(verify_semantic_coherence(presentation, extraction, model))
            flagged = len(report.observations) > 0
            runs.append(flagged)
            obs = "; ".join(o.issue for o in report.observations) or "—"
            print(f"  {name:18} run{rep + 1}: {'MARCADO' if flagged else 'ok     '}  {obs}")
        matrix[name] = runs

    def flagged_count(name: str) -> int:
        return sum(matrix[name])

    fp = flagged_count("a_fiel")  # falso positivo: marcó uno fiel
    fn = (A2_REPS - flagged_count("b_cifra_alterada")) + (
        A2_REPS - flagged_count("c_no_respaldado")
    )
    print("\n--- Resumen A2 ---")
    for name, _c, _v, should in A2_CASES:
        expected = "marcar" if should else "no marcar"
        print(f"  {name:18} marcado {flagged_count(name)}/{A2_REPS}  (esperado: {expected})")
    print(f"  Falsos positivos (a marcado): {fp}/{A2_REPS}")
    print(f"  Falsos negativos (b o c no marcado): {fn}/{2 * A2_REPS}")

    # Aserción esencial (no se ajusta para 'pasar'): la cifra alterada se detecta en la mayoría.
    assert flagged_count("b_cifra_alterada") > A2_REPS // 2, (
        f"el juez NO detectó la cifra alterada en la mayoría: {matrix['b_cifra_alterada']}"
    )


# ─────────────────────────────────────────────────────────────
# Humo básico de texto (se mantiene del hito anterior)
# ─────────────────────────────────────────────────────────────
@pytest.mark.integration
@_needs_key
def test_real_model_text() -> None:
    result = asyncio.run(
        transform(model=build_model(get_settings()), text="La empresa creció en 2024. Ventas: 150.")
    )
    assert isinstance(result.presentation, Presentation)
    assert len(result.presentation.sections) >= 1


# ─────────────────────────────────────────────────────────────
# Chat: una pregunta corta y ambigua contra el proveedor real
# ─────────────────────────────────────────────────────────────
@pytest.mark.integration
@_needs_key
def test_chat_responde_una_pregunta_corta_sin_salirse_del_esquema() -> None:
    """La pregunta corta era la que rompía el chat en producción.

    Con el esquema pedido como texto, el modelo contestaba conversando en vez de rellenar el
    sobre, y la validación moría en mitad del streaming: «Invalid JSON: expected value». Pasaba
    en casi todas las preguntas escritas y en ninguna sugerida, que son largas y específicas.

    Lo que comprueba este test, y no puede comprobar ningún mock, es que con el proveedor REAL la
    salida por herramienta aguanta ese caso. La prueba de que aguantó es que hubo eventos de
    texto: si el streaming hubiera reventado, el reintento sin streaming habría salvado el turno
    pero habría llegado entero de golpe, sin un solo parcial.
    """
    import asyncio

    from multimodal_presenter.pipeline.chat import chat_stream
    from multimodal_presenter.pipeline.extraction import prepare_input

    async def recoger():
        extraccion = prepare_input(
            text="Los duendes rojos ocurren por encima de las tormentas, a unos 80 km de altura."
        )
        return [
            evento
            async for evento in chat_stream(
                build_model(get_settings()),
                extraction=extraccion,
                history=[],
                question="¿y eso?",
            )
        ]

    eventos = asyncio.run(recoger())

    assert eventos, "el chat no emitió nada"
    assert eventos[-1].type == "done", "el turno no llegó a terminar"
    assert [e for e in eventos if e.type == "text"], (
        "no hubo texto en vivo: el streaming falló y lo salvó el reintento"
    )
