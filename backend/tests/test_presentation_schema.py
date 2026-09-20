"""Tests del contrato de datos (Hito 1).

La mitad importante de esta suite son los tests de RECHAZO: demuestran que el
contrato hace estructuralmente imposible desalinear el tipo declarado y el contenido
real — el bug del PoC anterior. El test que falla pesa tanto como el que pasa.
"""

import pytest
from pydantic import ValidationError

from smart_presenter.schemas import (
    ChartType,
    Presentation,
    Section,
    SectionRole,
)

# ─────────────────────────────────────────────────────────────
# Fixtures / helpers — bloques válidos reutilizables
# ─────────────────────────────────────────────────────────────
VALID_SOURCE = {"document_id": "doc-1", "quote": "un fragmento textual del documento"}


def _section(content: dict, role: str = "core") -> dict:
    return {
        "id": "s1",
        "role": role,
        "source": VALID_SOURCE,
        "content": content,
    }


# ─────────────────────────────────────────────────────────────
# ACEPTACIÓN — presentaciones bien formadas validan
# ─────────────────────────────────────────────────────────────
def test_valid_presentation_with_all_content_types_roundtrips() -> None:
    data = {
        "title": "Presentación de prueba",
        "sections": [
            _section({"content_type": "text", "text": "Hola mundo"}, role="core"),
            _section(
                {
                    "content_type": "table",
                    "columns": ["año", "ventas"],
                    "rows": [["2023", 100], ["2024", 150]],
                },
                role="satellite",
            ),
            _section(
                {
                    "content_type": "timeline",
                    "events": [{"date": "2023-01", "label": "Inicio"}],
                },
                role="core",
            ),
            _section(
                {
                    "content_type": "chart",
                    "chart_type": "bar",
                    "data": {
                        "categories": ["A", "B"],
                        "series": [{"name": "s1", "values": [1.0, 2.0]}],
                    },
                },
                role="satellite",
            ),
        ],
    }

    pres = Presentation.model_validate(data)

    assert len(pres.sections) == 4
    # El tipo se lee del contenido — fuente única de verdad, sin campo suelto.
    assert pres.sections[0].content.content_type == "text"
    assert pres.sections[3].content.chart_type is ChartType.BAR
    assert pres.sections[0].role is SectionRole.CORE
    # Round-trip: serializar y volver a validar produce lo mismo.
    assert Presentation.model_validate(pres.model_dump()) == pres


def test_source_reference_with_valid_offsets_accepted() -> None:
    sec = Section.model_validate(
        _section(
            {"content_type": "text", "text": "x"},
        )
        | {"source": {**VALID_SOURCE, "page": 2, "char_start": 10, "char_end": 40}}
    )
    assert sec.source.char_start == 10
    assert sec.source.char_end == 40


# ─────────────────────────────────────────────────────────────
# RECHAZO — el hueco content_type↔content está cerrado
# ─────────────────────────────────────────────────────────────
def test_chart_type_with_string_content_is_rejected() -> None:
    """El bug histórico: declarar chart pero dar un string como contenido."""
    with pytest.raises(ValidationError):
        Section.model_validate(_section("esto es solo un string"))


def test_chart_declared_without_chart_fields_is_rejected() -> None:
    """content_type='chart' sin chart_type ni data → rechazado."""
    with pytest.raises(ValidationError):
        Section.model_validate(_section({"content_type": "chart"}))


def test_text_content_cannot_carry_chart_fields() -> None:
    """content_type='text' con campos de chart → rechazado (extra='forbid')."""
    with pytest.raises(ValidationError):
        Section.model_validate(
            _section(
                {
                    "content_type": "text",
                    "text": "ok",
                    "chart_type": "pie",  # campo ajeno al tipo text
                }
            )
        )


def test_unknown_content_type_is_rejected() -> None:
    """Un content_type que no existe en la unión → rechazado."""
    with pytest.raises(ValidationError):
        Section.model_validate(_section({"content_type": "video", "url": "x"}))


def test_invalid_chart_type_is_rejected() -> None:
    """chart_type fuera del conjunto cerrado → rechazado."""
    with pytest.raises(ValidationError):
        Section.model_validate(
            _section(
                {
                    "content_type": "chart",
                    "chart_type": "donut3d",  # no está en ChartType
                    "data": {
                        "categories": ["A"],
                        "series": [{"name": "s", "values": [1.0]}],
                    },
                }
            )
        )


def test_table_row_width_must_match_columns() -> None:
    with pytest.raises(ValidationError):
        Section.model_validate(
            _section(
                {
                    "content_type": "table",
                    "columns": ["a", "b"],
                    "rows": [["solo-una-celda"]],  # faltan celdas
                }
            )
        )


# ─────────────────────────────────────────────────────────────
# RECHAZO — campos obligatorios del contrato
# ─────────────────────────────────────────────────────────────
def test_section_without_source_is_rejected() -> None:
    """Cada sección debe ser trazable a su fuente (Punto 4)."""
    payload = {"id": "s1", "role": "core", "content": {"content_type": "text", "text": "x"}}
    with pytest.raises(ValidationError):
        Section.model_validate(payload)


def test_section_without_role_is_rejected() -> None:
    """Cada sección debe estar marcada núcleo/satélite (Punto 6)."""
    payload = {"id": "s1", "source": VALID_SOURCE, "content": {"content_type": "text", "text": "x"}}
    with pytest.raises(ValidationError):
        Section.model_validate(payload)


def test_invalid_section_role_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Section.model_validate(_section({"content_type": "text", "text": "x"}, role="importante"))


def test_source_reference_end_before_start_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Section.model_validate(
            _section({"content_type": "text", "text": "x"})
            | {"source": {**VALID_SOURCE, "char_start": 50, "char_end": 10}}
        )


def test_empty_presentation_is_rejected() -> None:
    with pytest.raises(ValidationError):
        Presentation.model_validate({"title": "vacía", "sections": []})
