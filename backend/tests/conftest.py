"""Fixtures compartidas de los tests del pipeline (Hito 2)."""

import copy
import json
import os

import pytest
from pydantic_ai.models.test import TestModel

# Evita que los tests envíen trazas a Logfire real (no contaminar el dashboard que se usará
# para la telemetría del Hito 8). Debe ejecutarse antes de importar la app; conftest se
# carga antes que cualquier módulo de test. La app real (uvicorn) sí lee el token del .env.
os.environ["LOGFIRE_TOKEN"] = ""
os.environ["PYDANTIC_AI_NO_BANNER"] = "1"  # sin el banner de PydanticAI en la salida de tests

# Texto de entrada de referencia. Los `quote` del mock son substrings EXACTOS de este texto.
INPUT_TEXT = (
    "La empresa creció de forma sostenida durante la última década.\n\n"
    "En 2023 las ventas fueron 100 y en 2024 fueron 150."
)

# Presentación válida contra el contrato del Hito 1, con quotes anclables al INPUT_TEXT.
_MOCK_PRESENTATION = {
    "title": "Crecimiento de la empresa",
    "sections": [
        {
            "id": "s1",
            "role": "core",
            "source": {
                "document_id": "sin-verificar",
                "quote": "La empresa creció de forma sostenida durante la última década.",
            },
            "content": {"content_type": "text", "text": "La empresa creció en la última década."},
        },
        {
            "id": "s2",
            "role": "satellite",
            "source": {
                "document_id": "sin-verificar",
                "quote": "En 2023 las ventas fueron 100 y en 2024 fueron 150.",
            },
            "content": {
                "content_type": "table",
                "columns": ["año", "ventas"],
                "rows": [["2023", 100], ["2024", 150]],
            },
        },
    ],
}


@pytest.fixture
def input_text() -> str:
    return INPUT_TEXT


@pytest.fixture
def mock_presentation() -> dict:
    """Copia fresca del mock (quotes anclables)."""
    return copy.deepcopy(_MOCK_PRESENTATION)


@pytest.fixture
def structuring_model():
    """Fábrica de TestModel para mockear el agente de ESTRUCTURACIÓN (Fase 2).

    El agente usa `PromptedOutput` (salida por TEXTO: el modelo escribe el JSON como su
    respuesta), así que el mock debe entregar el JSON vía `custom_output_text`. `custom_output_args`
    solo aplica a salida por tool (`ToolOutput`), que sí usa el agente semántico.
    """

    def _make(presentation: dict) -> TestModel:
        return TestModel(custom_output_text=json.dumps(presentation))

    return _make


@pytest.fixture
def mock_presentation_ungrounded() -> dict:
    """Mock donde el quote de una sección NO existe en el texto fuente."""
    data = copy.deepcopy(_MOCK_PRESENTATION)
    data["sections"][1]["source"]["quote"] = "Este fragmento no está en el documento."
    return data


# --- Binario: bytes mínimos VÁLIDOS por magic bytes (para validación y pipeline) ---
PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
NOT_A_FILE = b"esto no es un archivo con magic bytes reconocible"


@pytest.fixture
def pdf_bytes() -> bytes:
    return PDF_BYTES


@pytest.fixture
def png_bytes() -> bytes:
    return PNG_BYTES
