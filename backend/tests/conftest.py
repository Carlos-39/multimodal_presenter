"""Fixtures compartidas de los tests del pipeline (Hito 2)."""

import copy
import io
import json
import os
import tempfile
import wave

import pytest
from pydantic_ai.models.test import TestModel

# Evita que los tests envíen trazas a Logfire real (no contaminar el dashboard que se usará
# para la telemetría del Hito 8). Debe ejecutarse antes de importar la app; conftest se
# carga antes que cualquier módulo de test. La app real (uvicorn) sí lee el token del .env.
os.environ["LOGFIRE_TOKEN"] = ""
os.environ["PYDANTIC_AI_NO_BANNER"] = "1"  # sin el banner de PydanticAI en la salida de tests

# La persistencia vive en disco y la app migra al arrancar, así que levantar la app en un test
# crearía la base REAL de quien corre los tests. Se apunta a una carpeta temporal de la sesión,
# por el mismo motivo que se vacían las claves: un test no puede tocar datos de verdad.
# Se pone ANTES de importar la app, igual que el token de Logfire.
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="mmp-tests-")

# El registro de cuentas viene CERRADO (ver `config.registro_abierto`), y la mitad de los tests de
# persistencia empiezan registrando a alguien. Se abre aquí, para toda la suite, en vez de en cada
# fixture: lo que esos tests comprueban es la biblioteca, no la puerta. El test de que la puerta
# cerrada responde 403 la cierra él mismo, con un ajuste propio.
os.environ["REGISTRO_ABIERTO"] = "true"

# Claves que el CI NO tiene y que la máquina del autor SÍ tiene en su `.env`.
_CLAVES_DE_API = (
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "OPENAI_API_KEY",
    "IDEOGRAM_API_KEY",
)


@pytest.fixture(autouse=True)
def sin_intentos_acumulados():
    """Vacía el contador de intentos fallidos antes y después de cada test.

    El contador vive en memoria del módulo, así que sobrevive de un test al siguiente y de un
    ARCHIVO al siguiente: cinco fallos a propósito en los tests de login dejarían a los de la
    biblioteca sin poder registrar a nadie, y el fallo aparecería lejos de su causa.
    """
    from multimodal_presenter.api.auth import _intentos

    _intentos.olvida_todo()
    yield
    _intentos.olvida_todo()


@pytest.fixture(autouse=True)
def sin_claves_reales(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch):
    """Vacía las claves de API en TODOS los tests que no sean de integración.

    Por qué existe: el CI corre **sin ninguna clave** (decisión del Hito 0 — se validan en
    runtime al construir el modelo, no al importar, y los tests mockean el LLM), pero la
    máquina del autor sí las tiene en `backend/.env`. Esa asimetría deja pasar tests mal
    mockeados: pasan en local y **fallan en el CI**. Con esta fixture, correr la suite en
    local es idéntico a correrla en el CI, así que el fallo aparece donde se puede arreglar.

    Pasó de verdad: un test de `/summary` esperaba un 415 del cuerpo del endpoint, pero
    FastAPI resuelve las dependencias ANTES de entrar a ese cuerpo, así que construía el
    modelo del adelanto con la clave real del `.env`. En el CI reventó.

    Las variables de entorno tienen precedencia sobre el `.env` en pydantic-settings, así que
    ponerlas vacías basta. Hay que limpiar la caché de `get_settings` (es `lru_cache`) antes y
    después, o el valor cacheado sobreviviría al parcheo.

    Los tests marcados `integration` quedan EXENTOS: llaman a las APIs de verdad y las
    necesitan. Si un test nuevo falla por falta de clave, la pregunta correcta es si le falta
    un mock o si debería estar marcado como de integración.
    """
    if request.node.get_closest_marker("integration"):
        yield
        return

    from multimodal_presenter.config import get_settings

    for clave in _CLAVES_DE_API:
        monkeypatch.setenv(clave, "")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


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


def make_wav(seconds: float, rate: int = 8000) -> bytes:
    """WAV silencioso REAL de la duración pedida (stdlib `wave`, sin dependencias).

    Se genera de verdad en vez de mockear la duración: así los tests del tope de duración
    ejercitan la lectura real de la cabecera, igual que los de PDF usan magic bytes reales.
    """
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(rate)
        writer.writeframes(b"\x00\x00" * int(rate * seconds))
    return buffer.getvalue()


@pytest.fixture
def wav_bytes() -> bytes:
    """Audio válido y corto (2.5 s), dentro de cualquier tope razonable."""
    return make_wav(2.5)
