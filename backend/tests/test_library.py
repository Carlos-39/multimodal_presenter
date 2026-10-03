"""Biblioteca (F2): guardar, listar, volver a abrir — y que nadie lea lo de otro.

Lo que de verdad hay que blindar aquí es el aislamiento entre cuentas. El resto son caminos
felices; esto es lo que, si falla, convierte la función en un problema.

Y una segunda cosa que importa igual: que **mandar `document_id` en vez del archivo** funcione y
exija propiedad. Es lo que permite que una presentación guardada siga sirviendo —chat, deck,
panel de fuente— desde un navegador que ya no tiene el `File`.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from multimodal_presenter.main import app

TEXTO = "Los duendes rojos ocurren muy por encima de las tormentas eléctricas intensas."

PAYLOAD = {
    "presentation": {
        "title": "Duendes rojos",
        "sections": [
            {
                "id": "s1",
                "role": "core",
                "source": {"document_id": "d", "quote": TEXTO},
                "content": {"content_type": "text", "text": "Ocurren sobre las tormentas."},
            }
        ],
    },
    "grounding": {
        "source_kind": "text",
        "sections": [{"section_id": "s1", "status": "verified"}],
        "total_sections": 1,
        "verified_sections": 1,
        "unverified_sections": 0,
        "not_found_sections": 0,
    },
}


@pytest.fixture
def client(tmp_path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    from multimodal_presenter.config import get_settings

    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    with TestClient(app) as cliente:
        yield cliente
    get_settings.cache_clear()


def _registra(client: TestClient, email: str) -> None:
    r = client.post("/auth/registro", json={"email": email, "contrasena": "unaclavelarga"})
    assert r.status_code == 201


def _guarda(client: TestClient, titulo: str = "Duendes rojos") -> dict:
    r = client.post(
        "/biblioteca/presentaciones",
        data={"payload": json.dumps(PAYLOAD), "titulo": titulo, "text": TEXTO},
    )
    assert r.status_code == 201, r.text
    return r.json()


# ─────────────────────────────────────────────────────────────
# Guardar y volver
# ─────────────────────────────────────────────────────────────
def test_guardar_y_listar(client: TestClient) -> None:
    _registra(client, "a@x.com")
    guardada = _guarda(client)
    assert guardada["titulo"] == "Duendes rojos"
    assert guardada["source_kind"] == "text"

    lista = client.get("/biblioteca/presentaciones").json()["presentaciones"]
    assert [p["id"] for p in lista] == [guardada["id"]]


def test_abrir_una_guardada_devuelve_el_contrato_intacto(client: TestClient) -> None:
    """Lo guardado tiene que volver tal cual: es el punto de toda la función."""
    _registra(client, "a@x.com")
    guardada = _guarda(client)

    from multimodal_presenter.schemas.library import PayloadGuardado

    completa = client.get(f"/biblioteca/presentaciones/{guardada['id']}").json()
    # Contra el contrato VALIDADO y no contra el literal de arriba: el contrato rellena valores
    # por defecto (page, char_start, illustration…), así que comparar con el literal mediría la
    # minuciosidad del test en vez de la fidelidad del guardado.
    esperado = PayloadGuardado.model_validate(PAYLOAD).model_dump(mode="json")
    assert PayloadGuardado.model_validate(completa["payload"]).model_dump(mode="json") == esperado
    assert completa["document_id"], "sin el documento, la presentación restaurada sería a medias"


def test_el_listado_no_trae_el_contenido(client: TestClient) -> None:
    """Un deck con imágenes pesa megas: la lista solo necesita saber de qué es cada cosa."""
    _registra(client, "a@x.com")
    _guarda(client)
    (fila,) = client.get("/biblioteca/presentaciones").json()["presentaciones"]
    assert "payload" not in fila


def test_varias_presentaciones_a_la_vez(client: TestClient) -> None:
    """ "Tener varias sesiones guardadas" es parte del encargo, no un extra."""
    _registra(client, "a@x.com")
    for titulo in ("Duendes", "Café", "Volcanes"):
        _guarda(client, titulo)
    lista = client.get("/biblioteca/presentaciones").json()["presentaciones"]
    assert len(lista) == 3
    # Se comprueban los TÍTULOS y no solo el número. Las tres salen del mismo texto, así que
    # comparten documento (el id es por contenido): contar habría pasado con el título en la
    # tabla equivocada, que es justo el bug que apareció al probar contra el backend real.
    assert {p["titulo"] for p in lista} == {"Duendes", "Café", "Volcanes"}


def test_un_payload_corrupto_no_entra(client: TestClient) -> None:
    """Validar al guardar y no al leer: lo corrupto es fácil de no notar hasta meses después."""
    _registra(client, "a@x.com")
    r = client.post(
        "/biblioteca/presentaciones",
        data={
            "payload": json.dumps({"presentation": "esto no es una presentación"}),
            "titulo": "mala",
            "text": TEXTO,
        },
    )
    assert r.status_code == 422


def test_borrar(client: TestClient) -> None:
    _registra(client, "a@x.com")
    guardada = _guarda(client)
    assert client.delete(f"/biblioteca/presentaciones/{guardada['id']}").status_code == 204
    assert client.get("/biblioteca/presentaciones").json()["presentaciones"] == []


# ─────────────────────────────────────────────────────────────
# Aislamiento entre cuentas: lo que no puede fallar
# ─────────────────────────────────────────────────────────────
def test_la_biblioteca_de_otro_no_se_ve(client: TestClient) -> None:
    _registra(client, "ana@x.com")
    _guarda(client)
    client.post("/auth/salir")

    _registra(client, "beto@x.com")
    assert client.get("/biblioteca/presentaciones").json()["presentaciones"] == []


def test_no_se_puede_abrir_la_presentacion_de_otro(client: TestClient) -> None:
    """404 y no 403: decir "existe pero no es tuya" ya es contar algo."""
    _registra(client, "ana@x.com")
    ajena = _guarda(client)["id"]
    client.post("/auth/salir")

    _registra(client, "beto@x.com")
    assert client.get(f"/biblioteca/presentaciones/{ajena}").status_code == 404


def test_no_se_puede_borrar_la_presentacion_de_otro(client: TestClient) -> None:
    _registra(client, "ana@x.com")
    ajena = _guarda(client)["id"]
    client.post("/auth/salir")

    _registra(client, "beto@x.com")
    assert client.delete(f"/biblioteca/presentaciones/{ajena}").status_code == 404

    client.post("/auth/salir")
    client.post("/auth/entrar", json={"email": "ana@x.com", "contrasena": "unaclavelarga"})
    assert len(client.get("/biblioteca/presentaciones").json()["presentaciones"]) == 1


@pytest.mark.parametrize(
    "metodo,ruta",
    [
        ("get", "/biblioteca/presentaciones"),
        ("get", "/biblioteca/presentaciones/pre-loquesea"),
        ("delete", "/biblioteca/presentaciones/pre-loquesea"),
    ],
)
def test_la_biblioteca_exige_cuenta(client: TestClient, metodo: str, ruta: str) -> None:
    assert getattr(client, metodo)(ruta).status_code == 401


def test_guardar_exige_cuenta(client: TestClient) -> None:
    r = client.post(
        "/biblioteca/presentaciones",
        data={"payload": json.dumps(PAYLOAD), "titulo": "t", "text": TEXTO},
    )
    assert r.status_code == 401


# ─────────────────────────────────────────────────────────────
# Mandar `document_id` en vez del archivo
# ─────────────────────────────────────────────────────────────
def _entrada(client: TestClient, document_id: str | None):
    """Llama al punto único por el que entra un documento, con el usuario de la sesión actual."""
    import asyncio

    from multimodal_presenter.api.routes import parse_document_inputs
    from multimodal_presenter.config import get_settings
    from multimodal_presenter.storage import conectar
    from multimodal_presenter.storage.users import usuario_de_sesion

    ajustes = get_settings()
    token = client.cookies.get("mmp_sesion")

    async def corre():
        async with conectar(ajustes) as conn:
            usuario = await usuario_de_sesion(conn, token)
        return await parse_document_inputs(None, None, ajustes, document_id, usuario)

    return asyncio.run(corre())


def test_el_documento_guardado_se_puede_volver_a_usar(client: TestClient) -> None:
    """Sin esto, una presentación restaurada no podría volver a usarse: el navegador que la abre
    mañana no tiene el `File`. Se prueba sobre el punto único por el que entra todo documento."""
    _registra(client, "a@x.com")
    doc_id = client.get(f"/biblioteca/presentaciones/{_guarda(client)['id']}").json()["document_id"]

    texto, binario, _media, _nombre = _entrada(client, doc_id)
    assert texto == TEXTO, "la fuente de texto vuelve por su carril, no como binario"
    assert binario is None


def test_el_document_id_de_otro_no_sirve(client: TestClient) -> None:
    """Es la comprobación que impide leer el documento de otra persona conociendo su id."""
    from fastapi import HTTPException

    _registra(client, "ana@x.com")
    ajeno = client.get(f"/biblioteca/presentaciones/{_guarda(client)['id']}").json()["document_id"]
    client.post("/auth/salir")
    _registra(client, "beto@x.com")

    with pytest.raises(HTTPException) as exc:
        _entrada(client, ajeno)
    assert exc.value.status_code == 404, (
        "404 y no 403: decir 'existe pero no es tuyo' ya cuenta algo"
    )


def test_sin_cuenta_el_document_id_no_sirve(client: TestClient) -> None:
    """El modo invitado sigue funcionando con archivo; lo que exige cuenta es el almacén."""
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        _entrada(client, "doc-loquesea01")
    assert exc.value.status_code == 401


def test_sin_nada_sigue_siendo_400(client: TestClient) -> None:
    """La degradación de siempre no cambia: sin documento, el error es el de antes."""
    from fastapi import HTTPException

    _registra(client, "a@x.com")
    with pytest.raises(HTTPException) as exc:
        _entrada(client, None)
    assert exc.value.status_code == 400


# ─────────────────────────────────────────────────────────────
# Historial de chat (F3): cierra el pendiente del Hito 6
# ─────────────────────────────────────────────────────────────
RESPUESTA = {
    "content": {"content_type": "text", "text": "Por encima de las nubes de tormenta."},
    "source": {"document_id": "d", "quote": TEXTO},
    "grounding": "verified",
}

CONVERSACION = {
    "mensajes": [
        {"rol": "user", "texto": "¿Dónde ocurren?"},
        {
            "rol": "assistant",
            "texto": "Por encima de las nubes de tormenta.",
            "respuesta": RESPUESTA,
        },
    ]
}


def test_el_chat_se_guarda_y_vuelve_con_la_presentacion(client: TestClient) -> None:
    """El punto de F3: la conversación sobrevive a recargar, y vuelve CON su presentación."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]

    r = client.put(f"/biblioteca/presentaciones/{pid}/chat", json=CONVERSACION)
    assert r.status_code == 204, r.text

    completa = client.get(f"/biblioteca/presentaciones/{pid}").json()
    assert [m["rol"] for m in completa["chat"]] == ["user", "assistant"]
    # El ancla es lo que importa de verdad: una respuesta restaurada sin su cita sería una
    # afirmación sin respaldo, justo lo que el proyecto dice no hacer.
    assert completa["chat"][1]["respuesta"]["source"]["quote"] == TEXTO
    assert completa["chat"][1]["respuesta"]["grounding"] == "verified"


def test_una_presentacion_recien_guardada_no_trae_chat(client: TestClient) -> None:
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    assert client.get(f"/biblioteca/presentaciones/{pid}").json()["chat"] == []


def test_guardar_el_chat_reemplaza_y_no_acumula(client: TestClient) -> None:
    """Es la razón de que sea `PUT`: mandarlo dos veces no puede duplicar la conversación."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]

    client.put(f"/biblioteca/presentaciones/{pid}/chat", json=CONVERSACION)
    client.put(f"/biblioteca/presentaciones/{pid}/chat", json=CONVERSACION)

    assert len(client.get(f"/biblioteca/presentaciones/{pid}").json()["chat"]) == 2


def test_el_orden_de_la_conversacion_se_conserva(client: TestClient) -> None:
    """Un historial desordenado no es el historial: las respuestas contestan a otra pregunta."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    turnos = [{"rol": "user", "texto": f"pregunta {i}"} for i in range(10)]

    client.put(f"/biblioteca/presentaciones/{pid}/chat", json={"mensajes": turnos})
    guardados = client.get(f"/biblioteca/presentaciones/{pid}").json()["chat"]
    assert [m["texto"] for m in guardados] == [t["texto"] for t in turnos]


def test_vaciar_el_chat(client: TestClient) -> None:
    """Empezar una conversación nueva sobre lo mismo tiene que poder borrar la anterior."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    client.put(f"/biblioteca/presentaciones/{pid}/chat", json=CONVERSACION)

    client.put(f"/biblioteca/presentaciones/{pid}/chat", json={"mensajes": []})
    assert client.get(f"/biblioteca/presentaciones/{pid}").json()["chat"] == []


def test_una_respuesta_corrupta_no_entra(client: TestClient) -> None:
    """Igual que el payload de la presentación: se valida al guardar, no al leer."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    r = client.put(
        f"/biblioteca/presentaciones/{pid}/chat",
        json={"mensajes": [{"rol": "assistant", "texto": "t", "respuesta": {"grounding": "no"}}]},
    )
    assert r.status_code == 422


def test_un_mensaje_del_usuario_no_lleva_respuesta_anclada(client: TestClient) -> None:
    """El rol dice quién habla; una pregunta con ancla sería un estado que no existe."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    r = client.put(
        f"/biblioteca/presentaciones/{pid}/chat",
        json={"mensajes": [{"rol": "user", "texto": "¿?", "respuesta": RESPUESTA}]},
    )
    assert r.status_code == 422


def test_el_chat_de_otro_no_se_puede_escribir(client: TestClient) -> None:
    """Sin esto, conocer un id de presentación bastaría para meter mensajes en la de otra
    persona — y quedarían indistinguibles de los suyos."""
    _registra(client, "ana@x.com")
    ajena = _guarda(client)["id"]
    client.put(f"/biblioteca/presentaciones/{ajena}/chat", json=CONVERSACION)
    client.post("/auth/salir")

    _registra(client, "beto@x.com")
    r = client.put(f"/biblioteca/presentaciones/{ajena}/chat", json={"mensajes": []})
    assert r.status_code == 404

    client.post("/auth/salir")
    client.post("/auth/entrar", json={"email": "ana@x.com", "contrasena": "unaclavelarga"})
    assert len(client.get(f"/biblioteca/presentaciones/{ajena}").json()["chat"]) == 2


def test_el_chat_exige_cuenta(client: TestClient) -> None:
    r = client.put("/biblioteca/presentaciones/pre-loquesea/chat", json={"mensajes": []})
    assert r.status_code == 401


def test_borrar_la_presentacion_se_lleva_su_chat(client: TestClient) -> None:
    """Depende de `PRAGMA foreign_keys` (va APAGADO por defecto en SQLite): sin él, el borrado en
    cascada no hace nada y la conversación queda huérfana en la base."""
    import asyncio

    from multimodal_presenter.config import get_settings
    from multimodal_presenter.storage import conectar

    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    client.put(f"/biblioteca/presentaciones/{pid}/chat", json=CONVERSACION)
    assert client.delete(f"/biblioteca/presentaciones/{pid}").status_code == 204

    async def quedan() -> int:
        async with conectar(get_settings()) as conn:
            async with conn.execute(
                "SELECT COUNT(*) AS n FROM mensajes_chat WHERE presentacion_id = ?", (pid,)
            ) as cur:
                return (await cur.fetchone())["n"]

    assert asyncio.run(quedan()) == 0
