"""Contrato de datos tipado de una presentación estructurada (Hito 1).

Este módulo es la **frontera entre backend y frontend**: todo lo demás se monta
encima de este contrato.

Principio de diseño crítico — cierre del hueco `content_type`↔`content`:
    El PoC anterior tenía `content_type` y `content` como campos independientes sin
    validación cruzada, así que se podía declarar `content_type="chart"` con un simple
    string como contenido y pasaba la validación. Aquí eso es **estructuralmente
    imposible**: no existe un campo `content_type` suelto a nivel de `Section`. El
    discriminador vive DENTRO de cada bloque de contenido, y `Section.content` es una
    *discriminated union* de Pydantic. El tipo declarado y el contenido real no pueden
    desalinearse porque son el mismo objeto.

Todos los modelos usan `extra="forbid"`: cualquier campo inesperado se rechaza (refuerza
el cierre del hueco — no se pueden colar campos de otro tipo de contenido).
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Strict(BaseModel):
    """Base común: prohíbe campos extra para un contrato estricto."""

    model_config = ConfigDict(extra="forbid")


# ─────────────────────────────────────────────────────────────
# Enums — conjuntos cerrados (no texto libre)
# ─────────────────────────────────────────────────────────────
class SectionRole(StrEnum):
    """Heurística núcleo/satélite (Punto 6 de las decisiones de diseño).

    Alimenta los modos resumen/detallado del frontend (Punto 11): núcleo → resumen,
    satélite → detallado.
    """

    CORE = "core"  # núcleo: esencial, autosuficiente
    SATELLITE = "satellite"  # satélite: apoyo, profundidad adicional


class ChartType(StrEnum):
    """Conjunto cerrado de tipos de gráfico admitidos (Punto 3, isomorfismo).

    El conjunto es cerrado (no texto libre). Qué tipo es *estructuralmente válido* según la
    forma real de los datos lo decide la regla determinista de `pipeline/isomorphism.py`
    (Hito 5a), que corrige el tipo si el LLM elige fuera de lo admisible.

    Nota sobre SCATTER: requiere pares numéricos (x, y) que la forma actual de `ChartData`
    (categorías + series) no modela, así que la regla de isomorfismo nunca lo admite hoy.
    TODO(Hito5x): soportar scatter exige evolucionar `ChartData` a puntos (x, y); fuera de 5a.
    """

    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    SCATTER = "scatter"


# ─────────────────────────────────────────────────────────────
# Atribución de fuente — no decorativa (Punto 4)
# ─────────────────────────────────────────────────────────────
class SourceReference(_Strict):
    """Referencia al fragmento del documento original del que proviene la sección.

    Modelada para el resaltado interactivo directo sobre el documento fuente (Punto 4):
    al hacer clic en una afirmación, el frontend deberá localizar y resaltar el fragmento
    exacto. Por eso incluye el texto citado y coordenadas para localizarlo.
    """

    document_id: str = Field(min_length=1, description="Identificador del documento fuente.")
    quote: str = Field(min_length=1, description="Fragmento exacto citado (lo que se resaltará).")
    page: int | None = Field(default=None, ge=1, description="Página en el PDF fuente (Hito 4).")
    char_start: int | None = Field(
        default=None, ge=0, description="Offset inicial en el texto extraído."
    )
    char_end: int | None = Field(
        default=None, ge=0, description="Offset final en el texto extraído."
    )

    @model_validator(mode="after")
    def _check_offset_range(self) -> SourceReference:
        if (
            self.char_start is not None
            and self.char_end is not None
            and self.char_end < self.char_start
        ):
            raise ValueError("char_end debe ser >= char_start")
        return self


# ─────────────────────────────────────────────────────────────
# Bloques de contenido — cada uno con su discriminador `content_type`
# ─────────────────────────────────────────────────────────────
class TextContent(_Strict):
    content_type: Literal["text"] = "text"
    text: str = Field(min_length=1)


class TableContent(_Strict):
    content_type: Literal["table"] = "table"
    columns: list[str] = Field(min_length=1)
    rows: list[list[str | int | float]]

    @model_validator(mode="after")
    def _check_row_widths(self) -> TableContent:
        expected = len(self.columns)
        for i, row in enumerate(self.rows):
            if len(row) != expected:
                raise ValueError(f"la fila {i} tiene {len(row)} celdas; se esperaban {expected}")
        return self


class TimelineEvent(_Strict):
    date: str = Field(min_length=1, description="Fecha del evento (texto; parseo en ingesta).")
    label: str = Field(min_length=1)
    description: str | None = None


class TimelineContent(_Strict):
    content_type: Literal["timeline"] = "timeline"
    events: list[TimelineEvent] = Field(min_length=1)


class ChartSeries(_Strict):
    name: str = Field(min_length=1)
    values: list[float] = Field(min_length=1)


class ChartData(_Strict):
    categories: list[str] = Field(min_length=1)
    series: list[ChartSeries] = Field(min_length=1)
    # La regla de isomorfismo (Hito 5a) deriva la forma de estos datos (alineación,
    # nº de series, orden temporal) en `pipeline/isomorphism.py` y corrige/degrada el
    # gráfico si el tipo elegido no es admisible.


class ChartContent(_Strict):
    content_type: Literal["chart"] = "chart"
    chart_type: ChartType
    data: ChartData


# ─────────────────────────────────────────────────────────────
# Discriminated union: el corazón del cierre del hueco
# ─────────────────────────────────────────────────────────────
SectionContent = Annotated[
    TextContent | TableContent | TimelineContent | ChartContent,
    Field(discriminator="content_type"),
]


ILLUSTRATION_LABEL = "Ilustración de apoyo (generada, no proviene del documento)"


class GeneratedIllustration(_Strict):
    """Ilustración de apoyo GENERADA (Hito 5h Parte 1). NO es contenido trazable.

    Es un campo APARTE de `Section` (no un `SectionContent` ni un `Section`), y DELIBERADAMENTE
    carece de `SourceReference`: es estructuralmente imposible que tenga estado de grounding, para
    que nunca se confunda con contenido verificado. Lleva una etiqueta obligatoria y permanente.
    """

    kind: Literal["generated_illustration"] = "generated_illustration"
    image_url: str = Field(min_length=1, description="Imagen generada (data URI).")
    alt: str = Field(min_length=1, description="Descripción accesible de la ilustración.")
    label: str = ILLUSTRATION_LABEL  # etiqueta obligatoria, siempre visible


class Section(_Strict):
    """Unidad de la presentación. Campos comunes + un bloque de contenido tipado.

    `content_type` no existe como campo suelto aquí: es intrínseco a `content` (su
    discriminador). Fuente única de verdad para el tipo de la sección.
    """

    id: str = Field(min_length=1)
    title: str | None = None
    role: SectionRole  # obligatorio: fuerza la clasificación núcleo/satélite
    source: SourceReference  # obligatorio: cada sección debe ser trazable a su fuente
    content: SectionContent
    # Apoyo visual generado (opcional, Hito 5h Parte 1). SIN fuente ni grounding: no es contenido
    # trazable, es una ayuda didáctica declarada como tal. Default None → backward-compatible.
    illustration: GeneratedIllustration | None = None


class Presentation(_Strict):
    """Presentación estructurada completa — la raíz del contrato."""

    title: str = Field(min_length=1)
    sections: list[Section] = Field(min_length=1)
