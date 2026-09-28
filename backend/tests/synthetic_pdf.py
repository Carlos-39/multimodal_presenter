"""Generador del PDF sintético DISCRIMINANTE (Hito 5f, A1) — con verdad de referencia conocida.

La prueba de A1 necesita demostrar que el modelo LEE contenido visual que un extractor de texto
perdería. Para asertarlo objetivamente, este PDF mezcla tres cosas cuya procedencia conocemos:

- GRÁFICO rasterizado (imagen PNG): sus valores existen SOLO como píxeles + etiquetas dibujadas
  dentro de la imagen. `pypdf` no puede extraerlos (eso reproduce el error del PoC anterior).
  Las etiquetas van impresas SOBRE cada barra a propósito: la prueba mide "¿lee lo visual?", no
  "¿estima alturas de píxeles?".
- TABLA como TEXTO real del PDF: sus valores SÍ son extraíbles por `pypdf`.
- PÁRRAFO de contexto (texto real), sin ninguno de los números anteriores.

Los valores del gráfico y de la tabla son conjuntos DISJUNTOS, así el test puede distinguir qué
leyó el modelo de cada fuente. Este fixture es sintético y determinista → se commitea.
"""

from __future__ import annotations

import io

import matplotlib

matplotlib.use("Agg")  # sin display: solo renderiza a PNG
import matplotlib.pyplot as plt  # noqa: E402
from fpdf import FPDF  # noqa: E402

# ── Verdad de referencia (lo que el test aserta contra la salida del modelo) ──
CHART_TITLE = "Ventas anuales (millones COP)"
CHART_CATEGORIES: list[str] = ["2021", "2022", "2023", "2024"]
CHART_VALUES: list[int] = [80, 130, 190, 240]  # SOLO existen como píxeles

TABLE_TITLE = "Costos operativos por trimestre 2024 (millones COP)"
TABLE_HEADERS: list[str] = ["Trimestre", "Costo"]
TABLE_ROWS: list[tuple[str, int]] = [("Q1", 42), ("Q2", 51), ("Q3", 48), ("Q4", 55)]  # texto real

CONTEXT_PARAGRAPH = (
    "Andina Solar es una empresa colombiana de ensamblaje de paneles solares fundada en 2015. "
    "El presente informe resume su desempeno reciente y sus retos operativos. La companhia opera "
    "una unica planta y depende de componentes importados cuyo precio varia con la tasa de cambio."
)

# La imagen del gráfico va en la página 2 (para verificar también que source.page es correcto).
CHART_PAGE = 2


def _chart_png() -> bytes:
    """Barras con los valores del gráfico ETIQUETADOS sobre cada barra (legibles para el modelo)."""
    fig, ax = plt.subplots(figsize=(6.4, 3.6), dpi=150)
    bars = ax.bar(CHART_CATEGORIES, CHART_VALUES, color="#2a78d6")
    ax.set_title(CHART_TITLE)
    ax.set_xlabel("Anho")
    ax.set_ylabel("Ventas (millones COP)")
    ax.set_ylim(0, max(CHART_VALUES) * 1.2)
    for bar, value in zip(bars, CHART_VALUES, strict=True):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(CHART_VALUES) * 0.02,
            str(value),
            ha="center",
            va="bottom",
            fontsize=12,
            fontweight="bold",
        )
    fig.tight_layout()
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png")
    plt.close(fig)
    return buffer.getvalue()


def build_discriminant_pdf() -> bytes:
    """Ensambla el PDF: pág. 1 (párrafo + tabla como texto real), pág. 2 (gráfico rasterizado)."""
    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Página 1: contexto (texto) + tabla (texto real, extraíble) ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Informe Andina Solar", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 6, CONTEXT_PARAGRAPH)
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, TABLE_TITLE, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(40, 8, TABLE_HEADERS[0], border=1)
    pdf.cell(40, 8, TABLE_HEADERS[1], border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    for label, value in TABLE_ROWS:
        pdf.cell(40, 8, label, border=1)
        pdf.cell(40, 8, str(value), border=1, new_x="LMARGIN", new_y="NEXT")

    # ── Página 2: gráfico como IMAGEN (valores solo en píxeles) ──
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Figura 1. Evolucion de ventas", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.image(io.BytesIO(_chart_png()), w=170)

    out = pdf.output()
    return bytes(out)
