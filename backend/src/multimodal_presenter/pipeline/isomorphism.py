"""Isomorfismo estructural de gráficos (Punto 3 de Fase 2) — determinista, sin LLM.

Un gráfico cuya forma visual no corresponde a la estructura real de los datos enseña una
relación falsa (interferencia estructural, Schnotz) — peor que no mostrar gráfico. Aquí:

1. `admissible_chart_types(data)`: dada la FORMA real de los datos, qué tipos son
   estructuralmente válidos.
2. `enforce_isomorphism(presentation)`: aplica la regla al resultado del LLM. Como el LLM
   genera datos+tipo juntos, la regla no pre-restringe su elección: la CORRIGE después de
   forma **determinista y reproducible** (misma forma inválida → misma corrección siempre,
   coherente con el Punto 1.5). Si ningún tipo es válido, DEGRADA el gráfico a tabla.

La regla vive aquí (código), NO en el prompt del modelo.
"""

import math
import re

from ..schemas.presentation import (
    ChartContent,
    ChartData,
    ChartType,
    Presentation,
    Section,
    TableContent,
)
from ..schemas.transform import ChartNote

_YEAR = re.compile(r"^\d{4}$")
_ISO_DATE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")


def _is_temporal(categories: list[str]) -> bool:
    """Todas las categorías parecen fechas/años (progresión temporal)."""
    if len(categories) < 2:
        return False
    return all(_YEAR.match(c) or _ISO_DATE.match(c) for c in categories)


def _is_numeric_increasing(categories: list[str]) -> bool:
    """Todas numéricas y estrictamente crecientes (eje ordenado no temporal)."""
    if len(categories) < 2:
        return False
    try:
        nums = [float(c) for c in categories]
    except ValueError:
        return False
    return all(b > a for a, b in zip(nums, nums[1:], strict=True))


def _is_ordered_axis(categories: list[str]) -> bool:
    return _is_temporal(categories) or _is_numeric_increasing(categories)


def _aligned(data: ChartData) -> bool:
    n = len(data.categories)
    return all(len(s.values) == n for s in data.series)


def _finite(data: ChartData) -> bool:
    return all(math.isfinite(v) for s in data.series for v in s.values)


def _nonneg(data: ChartData) -> bool:
    return all(v >= 0 for s in data.series for v in s.values)


def admissible_chart_types(data: ChartData) -> set[ChartType]:
    """Conjunto de tipos estructuralmente válidos para la forma de estos datos."""
    if not _aligned(data) or not _finite(data):
        return set()  # datos malformados → ningún gráfico fiable

    n = len(data.categories)
    single = len(data.series) == 1
    ordered = _is_ordered_axis(data.categories)

    valid: set[ChartType] = {ChartType.BAR}  # comparación de categorías discretas: siempre
    if ordered and n >= 2:
        valid.add(ChartType.LINE)  # hay progresión que justifica unir puntos
    if single and _nonneg(data) and not ordered and 2 <= n <= 8:
        valid.add(ChartType.PIE)  # partes de un todo
    # scatter: requiere pares numéricos (x,y) que esta forma (categorías+series) no modela.
    # TODO(Hito5x): soportar scatter exige evolucionar ChartData a puntos (x,y). Fuera de 5a.
    return valid


def _best_admissible(admissible: set[ChartType], ordered: bool) -> ChartType | None:
    """Prioridad FIJA y reproducible para elegir el mejor tipo admisible."""
    if ordered and ChartType.LINE in admissible:
        return ChartType.LINE
    if ChartType.BAR in admissible:
        return ChartType.BAR
    if ChartType.PIE in admissible:
        return ChartType.PIE
    if ChartType.LINE in admissible:
        return ChartType.LINE
    return None


def _degrade_to_table(chart: ChartContent) -> TableContent:
    """Convierte un gráfico no representable en una tabla (nunca falla en silencio)."""
    data = chart.data
    columns = ["Categoría", *[s.name for s in data.series]]
    rows: list[list[str | int | float]] = []
    for i, category in enumerate(data.categories):
        row: list[str | int | float] = [category]
        for s in data.series:
            row.append(s.values[i] if i < len(s.values) else "")
        rows.append(row)
    return TableContent(columns=columns, rows=rows)


def enforce_isomorphism(presentation: Presentation) -> tuple[Presentation, list[ChartNote]]:
    """Aplica la regla de isomorfismo a cada sección de gráfico. Devuelve (presentación, notas)."""
    new_sections: list[Section] = []
    notes: list[ChartNote] = []

    for section in presentation.sections:
        content = section.content
        if not isinstance(content, ChartContent):
            new_sections.append(section)
            continue

        admissible = admissible_chart_types(content.data)
        ordered = _is_ordered_axis(content.data.categories)

        if content.chart_type in admissible:
            new_sections.append(section)  # ya es isomorfo
            continue

        best = _best_admissible(admissible, ordered)
        if best is None:
            # Ningún gráfico válido → degradar a tabla, con nota visible.
            table = _degrade_to_table(content)
            new_sections.append(section.model_copy(update={"content": table}))
            notes.append(
                ChartNote(
                    section_id=section.id,
                    kind="degraded",
                    detail="Los datos no admiten un gráfico fiable; se muestra como tabla.",
                )
            )
        else:
            # Corrección determinista al mejor tipo admisible.
            corrected = content.model_copy(update={"chart_type": best})
            new_sections.append(section.model_copy(update={"content": corrected}))
            notes.append(
                ChartNote(
                    section_id=section.id,
                    kind="corrected",
                    detail=f"Tipo de gráfico corregido de '{content.chart_type}' a '{best}' "
                    "según la forma de los datos.",
                )
            )

    return presentation.model_copy(update={"sections": new_sections}), notes
