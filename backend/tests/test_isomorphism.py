"""Tests de la regla determinista de isomorfismo de gráficos (Hito 5a)."""

from multimodal_presenter.pipeline.isomorphism import (
    admissible_chart_types,
    enforce_isomorphism,
)
from multimodal_presenter.schemas import Presentation
from multimodal_presenter.schemas.presentation import ChartContent, ChartData, ChartType


def _data(categories: list[str], series: list[dict]) -> ChartData:
    return ChartData.model_validate({"categories": categories, "series": series})


def _chart_pres(chart_type: str, categories: list[str], series: list[dict]) -> Presentation:
    return Presentation.model_validate(
        {
            "title": "t",
            "sections": [
                {
                    "id": "c1",
                    "role": "satellite",
                    "source": {"document_id": "d", "quote": "q"},
                    "content": {
                        "content_type": "chart",
                        "chart_type": chart_type,
                        "data": {"categories": categories, "series": series},
                    },
                }
            ],
        }
    )


# --- admissible_chart_types: aceptación ---
def test_temporal_single_admits_line_bar_not_pie() -> None:
    a = admissible_chart_types(
        _data(["2020", "2021", "2022"], [{"name": "v", "values": [1, 2, 3]}])
    )
    assert ChartType.LINE in a and ChartType.BAR in a
    assert ChartType.PIE not in a  # eje ordenado → pie no
    assert ChartType.SCATTER not in a


def test_categorical_single_admits_pie_bar_not_line() -> None:
    a = admissible_chart_types(_data(["A", "B", "C"], [{"name": "v", "values": [1, 2, 3]}]))
    assert ChartType.PIE in a and ChartType.BAR in a
    assert ChartType.LINE not in a  # sin eje ordenado → line no


def test_multiseries_only_bar() -> None:
    a = admissible_chart_types(
        _data(["A", "B"], [{"name": "x", "values": [1, 2]}, {"name": "y", "values": [3, 4]}])
    )
    assert a == {ChartType.BAR}


def test_misaligned_admits_nothing() -> None:
    a = admissible_chart_types(_data(["A", "B", "C"], [{"name": "v", "values": [1, 2]}]))
    assert a == set()


# --- enforce_isomorphism: rechazo/corrección (pesa igual que la aceptación) ---
def test_valid_chart_is_kept() -> None:
    fixed, notes = enforce_isomorphism(
        _chart_pres("bar", ["A", "B"], [{"name": "v", "values": [1, 2]}])
    )
    assert isinstance(fixed.sections[0].content, ChartContent)
    assert fixed.sections[0].content.chart_type is ChartType.BAR
    assert notes == []


def test_pie_on_temporal_corrected_to_line() -> None:
    fixed, notes = enforce_isomorphism(
        _chart_pres("pie", ["2020", "2021", "2022"], [{"name": "v", "values": [1, 2, 3]}])
    )
    assert fixed.sections[0].content.chart_type is ChartType.LINE
    assert notes[0].kind == "corrected"


def test_line_on_categorical_corrected_to_bar() -> None:
    fixed, _ = enforce_isomorphism(
        _chart_pres("line", ["A", "B", "C"], [{"name": "v", "values": [1, 2, 3]}])
    )
    assert fixed.sections[0].content.chart_type is ChartType.BAR


def test_scatter_is_never_admissible_so_corrected() -> None:
    fixed, notes = enforce_isomorphism(
        _chart_pres("scatter", ["A", "B"], [{"name": "v", "values": [1, 2]}])
    )
    assert fixed.sections[0].content.chart_type is not ChartType.SCATTER
    assert notes[0].kind == "corrected"


def test_misaligned_degraded_to_table() -> None:
    fixed, notes = enforce_isomorphism(
        _chart_pres("bar", ["A", "B", "C"], [{"name": "v", "values": [1, 2]}])
    )
    assert fixed.sections[0].content.content_type == "table"
    assert notes[0].kind == "degraded"


def test_correction_is_deterministic() -> None:
    # Misma forma inválida → misma corrección siempre (Punto 1.5).
    args = ("pie", ["2020", "2021", "2022"], [{"name": "v", "values": [1, 2, 3]}])
    first, _ = enforce_isomorphism(_chart_pres(*args))
    second, _ = enforce_isomorphism(_chart_pres(*args))
    assert first.sections[0].content.chart_type is second.sections[0].content.chart_type
