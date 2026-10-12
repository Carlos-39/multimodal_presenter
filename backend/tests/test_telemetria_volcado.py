"""El volcado de telemetría y el respaldo de la base.

Son las dos piezas que convierten «los datos están en un volumen al que no llego» en «los datos
están en mi máquina el mismo día». Lo que se fija aquí:

1. **Sin token configurado, el endpoint no existe.** 404, como cualquier ruta inventada.
2. **El token se compara entero.** Acertar el principio no sirve de nada.
3. **Sale lo que entró**, en orden y sin reinterpretarlo: el crudo es el respaldo.
4. **El respaldo de la base se hace con `VACUUM INTO`** y produce una base que de verdad abre y
   trae los datos.
"""

from __future__ import annotations

import asyncio
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from multimodal_presenter.config import Settings, get_settings
from multimodal_presenter.main import app
from multimodal_presenter.storage import db

TOKEN = "token-largo-de-telemetria-2026"
RUTA = "/telemetry/volcado"


@pytest.fixture
def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "datos"))
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "telemetria"))
    get_settings.cache_clear()
    with TestClient(app) as cliente:
        yield cliente
    get_settings.cache_clear()


def _manda_eventos(client: TestClient, cuantos: int, participante: str = "P07") -> None:
    eventos = [
        {
            "session_id": "s-1",
            "participant": participante,
            "name": "session_start",
            "ts": f"2026-10-12T05:0{i}:00Z",
            "seq": i,
            "data": {},
        }
        for i in range(cuantos)
    ]
    assert client.post("/telemetry", json={"events": eventos}).status_code == 204


def test_sin_token_configurado_el_endpoint_no_existe(client: TestClient) -> None:
    """404 y no 403: una puerta que anuncia que está cerrada invita a probar la llave."""
    _manda_eventos(client, 1)
    assert client.get(RUTA).status_code == 404
    assert client.get(RUTA, headers={"X-Telemetria-Token": "loquesea"}).status_code == 404


def test_con_token_mal_no_se_baja_nada(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEMETRIA_TOKEN", TOKEN)
    get_settings.cache_clear()
    _manda_eventos(client, 1)

    assert client.get(RUTA).status_code == 401
    assert client.get(RUTA, headers={"X-Telemetria-Token": ""}).status_code == 401
    # Ni acertando el principio: se compara entero.
    assert client.get(RUTA, headers={"X-Telemetria-Token": TOKEN[:-1]}).status_code == 401
    assert client.get(RUTA, headers={"X-Telemetria-Token": TOKEN + "x"}).status_code == 401


def test_sale_lo_que_entro_sin_reinterpretarlo(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """El crudo ES el respaldo: si aquí se transformara algo, el respaldo sería una versión."""
    monkeypatch.setenv("TELEMETRIA_TOKEN", TOKEN)
    get_settings.cache_clear()
    _manda_eventos(client, 3)

    r = client.get(RUTA, headers={"X-Telemetria-Token": TOKEN})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-ndjson")

    lineas = [json.loads(linea) for linea in r.text.splitlines() if linea.strip()]
    assert len(lineas) == 3
    assert [e["seq"] for e in lineas] == [0, 1, 2]
    assert {e["participant"] for e in lineas} == {"P07"}
    # El sello del servidor viaja: es lo que permite cruzar con el reloj del facilitador.
    assert all("received_at" in e for e in lineas)


def test_sin_eventos_todavia_no_es_un_error_de_token(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Distinguirlo importa el día de la sesión: 404 es «aún no hay nada», 401 es «token mal»."""
    monkeypatch.setenv("TELEMETRIA_TOKEN", TOKEN)
    get_settings.cache_clear()
    assert client.get(RUTA, headers={"X-Telemetria-Token": TOKEN}).status_code == 404


def test_el_respaldo_de_la_base_abre_y_trae_los_datos(tmp_path) -> None:
    """`VACUUM INTO` y no una copia del archivo: con WAL, copiar en caliente puede dar una base
    que abre y ha perdido lo último."""
    ajustes = Settings(data_dir=str(tmp_path / "datos"), logfire_token="")

    async def flujo():
        await db.migrar(ajustes)
        async with db.conectar(ajustes) as conn:
            await conn.execute(
                "INSERT INTO usuarios (id, email, password_hash, creado_en) VALUES (?,?,?,?)",
                ("u1", "a@b.com", "hash", db.ahora()),
            )
            await conn.commit()
        return await db.respaldar(ajustes, tmp_path / "copias" / "base.db")

    copia = asyncio.run(flujo())
    assert copia.exists()

    con = sqlite3.connect(copia)
    assert con.execute("SELECT email FROM usuarios").fetchone()[0] == "a@b.com"
    # Y el esquema entero viajó, no solo la tabla que se tocó.
    tablas = {f[0] for f in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"usuarios", "presentaciones", "documentos", "migraciones"} <= tablas
    con.close()


def test_un_respaldo_no_puede_pisar_a_otro(tmp_path) -> None:
    """SQLite se niega a escribir sobre un archivo que ya existe, y aquí eso es una virtud."""
    ajustes = Settings(data_dir=str(tmp_path / "datos"), logfire_token="")
    destino = tmp_path / "copias" / "base.db"

    async def flujo():
        await db.migrar(ajustes)
        await db.respaldar(ajustes, destino)
        await db.respaldar(ajustes, destino)

    with pytest.raises(sqlite3.OperationalError):
        asyncio.run(flujo())
