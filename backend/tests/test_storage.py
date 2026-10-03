"""Almacenamiento (F0 de login + persistencia): esquema, migraciones y documentos en disco.

Todo contra una base TEMPORAL: estos tests no pueden tocar los datos reales de la máquina, igual
que los de telemetría escriben en `tmp_path`.

Lo que se fija aquí, por orden de importancia:

1. **Que las claves foráneas estén encendidas.** En SQLite vienen apagadas por defecto y son por
   conexión: sin ellas, los `ON DELETE CASCADE` del esquema no hacen nada y borrar un usuario
   deja sus presentaciones colgando. Es un fallo silencioso, así que se comprueba.
2. **Que guardar sea idempotente y direccionable por contenido**, que es lo que permite no
   duplicar bytes ni coordinar nada.
3. **Que no se puedan guardar bytes bajo un id ajeno.** El id es la ruta y la clave primaria: un
   desajuste ahí deja el almacén mintiendo de forma indetectable.
"""

from __future__ import annotations

import asyncio
import json

import pytest

from multimodal_presenter.config import Settings
from multimodal_presenter.pipeline.extraction import compute_document_id
from multimodal_presenter.storage import db, documents


@pytest.fixture
def ajustes(tmp_path) -> Settings:
    return Settings(data_dir=str(tmp_path), logfire_token="")


@pytest.fixture
def migrada(ajustes: Settings) -> Settings:
    asyncio.run(db.migrar(ajustes))
    return ajustes


# ─────────────────────────────────────────────────────────────
# Migraciones
# ─────────────────────────────────────────────────────────────
def test_migrar_crea_el_esquema(ajustes: Settings) -> None:
    aplicadas = asyncio.run(db.migrar(ajustes))
    assert aplicadas == [1]

    async def tablas() -> set[str]:
        async with (
            db.conectar(ajustes) as conn,
            conn.execute("SELECT name FROM sqlite_master WHERE type='table'") as cur,
        ):
            return {f["name"] for f in await cur.fetchall()}

    assert {
        "usuarios",
        "documentos",
        "propiedad",
        "presentaciones",
        "mensajes_chat",
        "artefactos",
    } <= asyncio.run(tablas())


def test_migrar_dos_veces_no_hace_nada_la_segunda(ajustes: Settings) -> None:
    """Idempotente: arrancar la aplicación dos veces no puede romper el esquema."""
    assert asyncio.run(db.migrar(ajustes)) == [1]
    assert asyncio.run(db.migrar(ajustes)) == []


def test_la_base_vive_donde_dice_la_configuracion(ajustes: Settings, tmp_path) -> None:
    asyncio.run(db.migrar(ajustes))
    assert db.db_path(ajustes) == tmp_path / "mmpresenter.db"
    assert db.db_path(ajustes).exists()


def test_sin_data_dir_la_base_queda_fuera_de_onedrive() -> None:
    """OneDrive sincronizando un archivo que se escribe en caliente corrompe SQLite.

    Misma lección que ya se aprendió con la telemetría; aquí se fija para que nadie "simplifique"
    el default poniéndolo junto al proyecto, que SÍ está dentro de OneDrive.
    """
    ruta = db.resolve_data_dir(Settings(data_dir=None, logfire_token=""))
    assert "OneDrive" not in str(ruta)


# ─────────────────────────────────────────────────────────────
# El esquema hace lo que dice
# ─────────────────────────────────────────────────────────────
def test_las_claves_foraneas_estan_encendidas(migrada: Settings) -> None:
    """En SQLite vienen APAGADAS por defecto, y son por conexión."""

    async def comprobar() -> int:
        async with db.conectar(migrada) as conn, conn.execute("PRAGMA foreign_keys") as cur:
            fila = await cur.fetchone()
            return fila[0]

    assert asyncio.run(comprobar()) == 1


def test_borrar_un_usuario_se_lleva_sus_presentaciones(migrada: Settings) -> None:
    """La cascada solo funciona si las foráneas están encendidas: esto lo prueba de verdad."""

    async def flujo() -> int:
        async with db.conectar(migrada) as conn:
            await conn.execute(
                "INSERT INTO usuarios (id, email, password_hash, creado_en) VALUES (?,?,?,?)",
                ("u1", "a@b.com", "hash", db.ahora()),
            )
            await conn.execute(
                "INSERT INTO documentos "
                "(document_id, source_kind, tamano_bytes, creado_en) VALUES (?,?,?,?)",
                ("doc-x", "text", 10, db.ahora()),
            )
            await conn.execute(
                "INSERT INTO presentaciones "
                "(id, usuario_id, document_id, version_contrato, payload_json, creada_en) "
                "VALUES (?,?,?,?,?,?)",
                ("p1", "u1", "doc-x", 1, json.dumps({"title": "t"}), db.ahora()),
            )
            await conn.execute(
                "INSERT INTO mensajes_chat "
                "(id, presentacion_id, orden, rol, texto, creado_en) VALUES (?,?,?,?,?,?)",
                ("m1", "p1", 0, "user", "¿y esto?", db.ahora()),
            )
            await conn.commit()

            await conn.execute("DELETE FROM usuarios WHERE id = 'u1'")
            await conn.commit()
            async with conn.execute("SELECT COUNT(*) FROM mensajes_chat") as cur:
                fila = await cur.fetchone()
                return fila[0]

    assert asyncio.run(flujo()) == 0, "el mensaje debió irse en cascada con su presentación"


def test_el_email_no_distingue_mayusculas(migrada: Settings) -> None:
    """Nadie espera que Carlos@x.com y carlos@x.com sean dos cuentas distintas."""
    import sqlite3

    async def flujo() -> None:
        async with db.conectar(migrada) as conn:
            await conn.execute(
                "INSERT INTO usuarios (id, email, password_hash, creado_en) VALUES (?,?,?,?)",
                ("u1", "Carlos@x.com", "h", db.ahora()),
            )
            await conn.commit()
            await conn.execute(
                "INSERT INTO usuarios (id, email, password_hash, creado_en) VALUES (?,?,?,?)",
                ("u2", "carlos@x.com", "h", db.ahora()),
            )
            await conn.commit()

    with pytest.raises(sqlite3.IntegrityError):
        asyncio.run(flujo())


# ─────────────────────────────────────────────────────────────
# Documentos en disco
# ─────────────────────────────────────────────────────────────
CONTENIDO = b"Los duendes rojos ocurren sobre las tormentas."


def test_guardar_y_leer_un_documento(migrada: Settings) -> None:
    doc_id = compute_document_id(CONTENIDO)

    async def flujo() -> bytes | None:
        async with db.conectar(migrada) as conn:
            await documents.guardar(
                conn,
                migrada,
                document_id=doc_id,
                source_kind="text",
                contenido=CONTENIDO,
            )
        return await documents.leer(migrada, doc_id)

    assert asyncio.run(flujo()) == CONTENIDO


def test_guardar_dos_veces_no_duplica(migrada: Settings) -> None:
    """Direccionable por contenido: el mismo documento subido dos veces es UNA fila y UN archivo."""
    doc_id = compute_document_id(CONTENIDO)

    async def flujo() -> int:
        async with db.conectar(migrada) as conn:
            for nombre in ("primera.pdf", "otra-vez.pdf"):
                await documents.guardar(
                    conn,
                    migrada,
                    document_id=doc_id,
                    source_kind="pdf",
                    contenido=CONTENIDO,
                    nombre_archivo=nombre,
                )
            async with conn.execute("SELECT COUNT(*) FROM documentos") as cur:
                fila = await cur.fetchone()
                return fila[0]

    assert asyncio.run(flujo()) == 1


def test_no_se_pueden_guardar_bytes_bajo_un_id_ajeno(migrada: Settings) -> None:
    """El id es la ruta y la clave primaria: un desajuste deja el almacén mintiendo."""

    async def flujo() -> None:
        async with db.conectar(migrada) as conn:
            await documents.guardar(
                conn,
                migrada,
                document_id="doc-inventado01",
                source_kind="text",
                contenido=CONTENIDO,
            )

    with pytest.raises(ValueError, match="no corresponde al contenido"):
        asyncio.run(flujo())


def test_leer_un_documento_que_no_esta_devuelve_none(migrada: Settings) -> None:
    """Nunca lanza por ausencia: quien llama ya sabe degradar, igual que con las imágenes."""
    assert asyncio.run(documents.leer(migrada, "doc-noexiste01")) is None


def test_los_metadatos_quedan_registrados(migrada: Settings) -> None:
    doc_id = compute_document_id(CONTENIDO)

    async def flujo():
        async with db.conectar(migrada) as conn:
            await documents.guardar(
                conn,
                migrada,
                document_id=doc_id,
                source_kind="pdf",
                contenido=CONTENIDO,
                nombre_archivo="duendes.pdf",
                media_type="application/pdf",
            )
            return await documents.metadatos(conn, doc_id)

    fila = asyncio.run(flujo())
    assert fila is not None
    assert fila["source_kind"] == "pdf"
    assert fila["nombre_archivo"] == "duendes.pdf"
    assert fila["media_type"] == "application/pdf"
    assert fila["tamano_bytes"] == len(CONTENIDO)
