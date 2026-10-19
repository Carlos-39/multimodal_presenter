"""Contrato de datos tipado (Pydantic), frontera backend↔frontend.

El schema de la presentación estructurada, con el hueco `content_type`↔`content`
cerrado vía discriminated union. Ver `presentation.py`.
"""

from .presentation import (
    ChartContent,
    ChartData,
    ChartSeries,
    ChartType,
    Presentation,
    Section,
    SectionContent,
    SectionRole,
    SourceReference,
    TableContent,
    TextContent,
    TimelineContent,
    TimelineEvent,
)

__all__ = [
    "ChartContent",
    "ChartData",
    "ChartSeries",
    "ChartType",
    "Presentation",
    "Section",
    "SectionContent",
    "SectionRole",
    "SourceReference",
    "TableContent",
    "TextContent",
    "TimelineContent",
    "TimelineEvent",
]
