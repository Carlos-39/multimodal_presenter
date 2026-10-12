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


def _guarda(client: TestClient, titulo: str = "Duendes rojos", payload: dict | None = None) -> dict:
    r = _post_guardar(client, titulo, payload or PAYLOAD)
    assert r.status_code == 201, r.text
    return r.json()


def _post_guardar(client: TestClient, titulo: str, payload: dict):
    """El payload viaja como PARTE DE ARCHIVO, no como campo.

    No es un detalle de implementación: como campo, el analizador de multipart lo topa en 1 MB y
    una presentación con ilustraciones (son data URIs, varios megas) no se podía guardar.
    """
    return client.post(
        "/biblioteca/presentaciones",
        data={"titulo": titulo, "text": TEXTO},
        files={"payload": ("payload.json", json.dumps(payload), "application/json")},
    )


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
    r = _post_guardar(client, "mala", {"presentation": "esto no es una presentación"})
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
    assert _post_guardar(client, "t", PAYLOAD).status_code == 401


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


# ─────────────────────────────────────────────────────────────
# Artefactos generados (F4): deck y narración
#
# Lo que se protege aquí no es el ahorro de una llamada al modelo: es que lo guardado sea lo
# MISMO al volver. Regenerar da otro guion y otra voz, y una presentación que cambia sola no era
# de nadie.
# ─────────────────────────────────────────────────────────────
DECK = {
    "slides": [
        {
            "title": "Dónde ocurren",
            "body": "Sobre las tormentas eléctricas intensas.",
            "bullets": ["Muy por encima de las nubes"],
            "source": {"document_id": "d", "quote": TEXTO},
            "grounding": "verified",
        }
    ]
}

MP3 = b"ID3\x04\x00\x00\x00\x00\x00\x00" + b"\x00" * 64  # cabecera real, contenido de relleno


def _ruta_deck(pid: str) -> str:
    return f"/biblioteca/presentaciones/{pid}/artefactos/deck"


def _ruta_narracion(pid: str) -> str:
    return f"/biblioteca/presentaciones/{pid}/artefactos/narracion"


def test_el_deck_guardado_vuelve_igual(client: TestClient) -> None:
    """El punto de F4: al volver salen LAS MISMAS diapositivas, no unas nuevas parecidas."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]

    assert client.put(_ruta_deck(pid), json=DECK).status_code == 204

    from multimodal_presenter.schemas.transform import GeneratedDeck

    vuelto = client.get(_ruta_deck(pid)).json()
    esperado = GeneratedDeck.model_validate(DECK).model_dump(mode="json")
    assert GeneratedDeck.model_validate(vuelto).model_dump(mode="json") == esperado


def test_abrir_una_presentacion_dice_qué_artefactos_tiene_sin_traerlos(client: TestClient) -> None:
    """La bandera es lo que deja que el botón diga «Abrir presentación» nada más restaurar.

    Y los artefactos NO viajan ahí: un deck con ilustraciones pesa megas y puede que nadie lo
    mire, mientras que abrir una presentación tiene que ser inmediato.
    """
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]

    recien = client.get(f"/biblioteca/presentaciones/{pid}").json()
    assert (recien["tiene_deck"], recien["tiene_narracion"]) == (False, False)

    client.put(_ruta_deck(pid), json=DECK)
    client.put(_ruta_narracion(pid), content=MP3)

    completa = client.get(f"/biblioteca/presentaciones/{pid}").json()
    assert (completa["tiene_deck"], completa["tiene_narracion"]) == (True, True)
    assert "deck" not in completa and "narracion" not in completa


def test_guardar_el_deck_reemplaza_al_anterior(client: TestClient) -> None:
    """Regenerar deja UN deck, no dos. Si no, abrir volvería a dar el primero para siempre."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]

    client.put(_ruta_deck(pid), json=DECK)
    otro = {"slides": [dict(DECK["slides"][0], title="Otro título")]}
    client.put(_ruta_deck(pid), json=otro)

    assert client.get(_ruta_deck(pid)).json()["slides"][0]["title"] == "Otro título"


def test_un_deck_corrupto_no_entra(client: TestClient) -> None:
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    assert client.put(_ruta_deck(pid), json={"slides": []}).status_code == 422


def test_la_narracion_vuelve_byte_a_byte(client: TestClient) -> None:
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]

    assert client.put(_ruta_narracion(pid), content=MP3).status_code == 204
    r = client.get(_ruta_narracion(pid))
    assert r.status_code == 200
    assert r.content == MP3
    assert r.headers["content-type"] == "audio/mpeg"


def test_lo_que_no_es_un_mp3_no_se_guarda(client: TestClient) -> None:
    """Un archivo que no suena es peor que no tener narración: parece que sí hay."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    assert client.put(_ruta_narracion(pid), content=b"<html>no soy audio</html>").status_code == 415
    assert client.get(_ruta_narracion(pid)).status_code == 404


def test_una_narracion_vacia_no_se_guarda(client: TestClient) -> None:
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    assert client.put(_ruta_narracion(pid), content=b"").status_code == 400


def test_sin_artefactos_pedirlos_da_404(client: TestClient) -> None:
    """404 y no un cuerpo vacío: «no hay» tiene que ser distinguible de «hay y está vacío»."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    assert client.get(_ruta_deck(pid)).status_code == 404
    assert client.get(_ruta_narracion(pid)).status_code == 404


def test_los_artefactos_de_otro_no_se_leen_ni_se_escriben(client: TestClient) -> None:
    """Conocer el id de una presentación ajena no puede bastar para ver su deck, oír su narración
    ni, peor, sustituirlos por otros."""
    _registra(client, "ana@x.com")
    ajena = _guarda(client)["id"]
    client.put(_ruta_deck(ajena), json=DECK)
    client.put(_ruta_narracion(ajena), content=MP3)
    client.post("/auth/salir")

    _registra(client, "beto@x.com")
    assert client.get(_ruta_deck(ajena)).status_code == 404
    assert client.get(_ruta_narracion(ajena)).status_code == 404
    otro = {"slides": [dict(DECK["slides"][0], title="Pisado")]}
    assert client.put(_ruta_deck(ajena), json=otro).status_code == 404
    assert client.put(_ruta_narracion(ajena), content=b"ID3\x04" + b"\x00" * 20).status_code == 404

    client.post("/auth/salir")
    client.post("/auth/entrar", json={"email": "ana@x.com", "contrasena": "unaclavelarga"})
    assert client.get(_ruta_deck(ajena)).json()["slides"][0]["title"] == "Dónde ocurren"
    assert client.get(_ruta_narracion(ajena)).content == MP3


def test_los_artefactos_exigen_cuenta(client: TestClient) -> None:
    assert client.get(_ruta_deck("pre-loquesea")).status_code == 401
    assert client.get(_ruta_narracion("pre-loquesea")).status_code == 401


def test_borrar_la_presentacion_se_lleva_el_mp3_del_disco(client: TestClient) -> None:
    """El `ON DELETE CASCADE` se lleva la fila, pero un archivo no se borra solo. Y este sí se
    puede borrar: la narración es de UNA presentación, no la comparte nadie."""
    from multimodal_presenter.config import get_settings
    from multimodal_presenter.storage.db import resolve_data_dir

    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    client.put(_ruta_narracion(pid), content=MP3)

    archivo = resolve_data_dir(get_settings()) / "narraciones" / f"{pid}.mp3"
    assert archivo.is_file(), "la narración debería estar en disco antes de borrar"

    client.delete(f"/biblioteca/presentaciones/{pid}")
    assert not archivo.exists(), "un mp3 huérfano por cada presentación borrada"


def test_si_el_archivo_desaparece_se_responde_que_no_hay(client: TestClient) -> None:
    """Alguien puede limpiar la carpeta a mano. «No hay» deja regenerar; un error no dice nada."""
    from multimodal_presenter.config import get_settings
    from multimodal_presenter.storage.db import resolve_data_dir

    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    client.put(_ruta_narracion(pid), content=MP3)
    (resolve_data_dir(get_settings()) / "narraciones" / f"{pid}.mp3").unlink()

    assert client.get(_ruta_narracion(pid)).status_code == 404


# ─────────────────────────────────────────────────────────────
# Actualizar en vez de duplicar
#
# Pulsar «Guardar» dos veces creaba dos presentaciones con el mismo nombre. Y deshabilitar el
# botón no habría bastado: lo que hay en pantalla puede CRECER después de guardarlo, porque las
# ilustraciones llegan en un post-pase.
# ─────────────────────────────────────────────────────────────
def _payload_con(titulo_seccion: str) -> dict:
    datos = json.loads(json.dumps(PAYLOAD))
    datos["presentation"]["sections"][0]["title"] = titulo_seccion
    return datos


def test_actualizar_no_crea_otra_presentacion(client: TestClient) -> None:
    """El punto del arreglo: volver a guardar completa lo guardado, no lo duplica."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]

    r = client.put(
        f"/biblioteca/presentaciones/{pid}",
        json={"payload": _payload_con("Con ilustración"), "titulo": "Duendes rojos"},
    )
    assert r.status_code == 204, r.text

    lista = client.get("/biblioteca/presentaciones").json()["presentaciones"]
    assert len(lista) == 1, "volver a guardar creó una presentación de más"
    completa = client.get(f"/biblioteca/presentaciones/{pid}").json()
    assert completa["payload"]["presentation"]["sections"][0]["title"] == "Con ilustración"


def test_actualizar_conserva_cuándo_se_creó(client: TestClient) -> None:
    """Es la MISMA presentación: completar lo guardado no la convierte en una nueva, y la
    biblioteca se ordena por esa fecha."""
    _registra(client, "a@x.com")
    guardada = _guarda(client)
    client.put(
        f"/biblioteca/presentaciones/{guardada['id']}",
        json={"payload": PAYLOAD, "titulo": "Otro nombre"},
    )
    completa = client.get(f"/biblioteca/presentaciones/{guardada['id']}").json()
    assert completa["creada_en"] == guardada["creada_en"]
    assert completa["titulo"] == "Otro nombre"


def test_actualizar_no_toca_el_chat_ni_los_artefactos(client: TestClient) -> None:
    """Completar la presentación no puede llevarse por delante lo que cuelga de ella."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    client.put(f"/biblioteca/presentaciones/{pid}/chat", json=CONVERSACION)
    client.put(_ruta_deck(pid), json=DECK)

    client.put(
        f"/biblioteca/presentaciones/{pid}",
        json={"payload": PAYLOAD, "titulo": "Duendes rojos"},
    )

    completa = client.get(f"/biblioteca/presentaciones/{pid}").json()
    assert len(completa["chat"]) == 2
    assert completa["tiene_deck"] is True


def test_no_se_puede_actualizar_la_de_otro(client: TestClient) -> None:
    """Sin esto, conocer un id ajeno bastaría para reescribir la presentación de otra persona."""
    _registra(client, "ana@x.com")
    ajena = _guarda(client)["id"]
    client.post("/auth/salir")

    _registra(client, "beto@x.com")
    r = client.put(
        f"/biblioteca/presentaciones/{ajena}",
        json={"payload": _payload_con("Pisado"), "titulo": "Pisado"},
    )
    assert r.status_code == 404

    client.post("/auth/salir")
    client.post("/auth/entrar", json={"email": "ana@x.com", "contrasena": "unaclavelarga"})
    assert client.get(f"/biblioteca/presentaciones/{ajena}").json()["titulo"] == "Duendes rojos"


def test_actualizar_con_un_payload_corrupto_no_entra(client: TestClient) -> None:
    """Mismo criterio que al guardar: se valida al escribir, no al leer."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]
    r = client.put(
        f"/biblioteca/presentaciones/{pid}",
        json={"payload": {"presentation": "esto no lo es"}, "titulo": "mala"},
    )
    assert r.status_code == 422


def test_actualizar_exige_cuenta(client: TestClient) -> None:
    r = client.put(
        "/biblioteca/presentaciones/pre-loquesea",
        json={"payload": PAYLOAD, "titulo": "t"},
    )
    assert r.status_code == 401


# ─────────────────────────────────────────────────────────────
# El payload grande: la regresión que de verdad dolía
#
# Las ilustraciones de apoyo son data URIs. Cuatro de ellas son ~3,5 MB, y el analizador de
# multipart topa en 1 MB las partes que NO son archivo. Mientras el payload viajó como campo de
# formulario, guardar una presentación ilustrada respondía 400 y la interfaz solo decía "No se
# pudo guardar". Se vio probando contra el sistema real, no con tests: los de entonces usaban
# payloads de laboratorio, de unos pocos cientos de bytes.
# ─────────────────────────────────────────────────────────────
def _payload_ilustrado(megas: int = 3) -> dict:
    """Un payload del tamaño real de una presentación con ilustraciones."""
    datos = json.loads(json.dumps(PAYLOAD))
    datos["presentation"]["sections"][0]["illustration"] = {
        "kind": "generated_illustration",
        # Un data URI de verdad, del tamaño de verdad.
        "image_url": "data:image/jpeg;base64," + ("A" * (megas * 1024 * 1024)),
        "alt": "Un duende rojo sobre una tormenta",
    }
    return datos


def test_se_puede_guardar_una_presentacion_con_ilustraciones(client: TestClient) -> None:
    _registra(client, "a@x.com")
    r = _post_guardar(client, "Con ilustraciones", _payload_ilustrado())
    assert r.status_code == 201, f"un payload de 3 MB no entró: {r.status_code}"

    completa = client.get(f"/biblioteca/presentaciones/{r.json()['id']}").json()
    url = completa["payload"]["presentation"]["sections"][0]["illustration"]["image_url"]
    assert len(url) > 3 * 1024 * 1024, "la ilustración se guardó recortada"


def test_se_puede_completar_con_ilustraciones_lo_ya_guardado(client: TestClient) -> None:
    """El caso exacto que motivó el arreglo: guardar en cuanto salen las secciones y volver a
    pulsar cuando llegan las ilustraciones."""
    _registra(client, "a@x.com")
    pid = _guarda(client)["id"]  # sin ilustraciones, como cuando se guarda pronto

    r = client.put(
        f"/biblioteca/presentaciones/{pid}",
        json={"payload": _payload_ilustrado(), "titulo": "Duendes rojos"},
    )
    assert r.status_code == 204, f"completar con 3 MB no entró: {r.status_code}"

    completa = client.get(f"/biblioteca/presentaciones/{pid}").json()
    assert completa["payload"]["presentation"]["sections"][0]["illustration"] is not None
    assert len(client.get("/biblioteca/presentaciones").json()["presentaciones"]) == 1


def test_un_payload_desmesurado_se_rechaza(client: TestClient) -> None:
    """Sin tope, un cuerpo enorme llenaría el disco antes de que nadie lo valide."""
    _registra(client, "a@x.com")
    r = _post_guardar(client, "enorme", _payload_ilustrado(megas=26))
    assert r.status_code == 413


def test_el_documento_se_sirve_sin_dejar_que_el_navegador_adivine(client: TestClient) -> None:
    """Son bytes de otra persona servidos desde NUESTRO origen: el tipo lo decidimos nosotros.

    El `media_type` sale de los magic bytes contra una allowlist, así que no puede ser `text/html`;
    `nosniff` cierra el resto, que es que el navegador lo adivine por su cuenta de todas formas.
    """
    _registra(client, "a@x.com")
    doc_id = client.get(f"/biblioteca/presentaciones/{_guarda(client)['id']}").json()["document_id"]

    res = client.get(f"/biblioteca/documentos/{doc_id}")
    assert res.status_code == 200
    assert res.headers["x-content-type-options"] == "nosniff"
    # Una fuente de texto no tiene nombre de archivo, así que no hay nombre que anunciar.
    assert res.headers["content-disposition"] == "inline"


def test_el_nombre_del_archivo_no_puede_partir_la_cabecera() -> None:
    """El nombre lo eligió quien subió el archivo. Interpolado tal cual, un salto de línea dentro
    partiría la cabecera en dos y dejaría añadir las que quisiera."""
    from multimodal_presenter.api.library import _disposicion

    assert _disposicion(None) == "inline"

    # El salto de línea no se borra: se CODIFICA. Que el texto siga ahí es inofensivo; lo que
    # importaba era que dejara de ser un salto de línea de verdad y no pudiera partir la cabecera.
    veneno = _disposicion("x\r\nSet-Cookie: sesion=robada\r\n")
    assert "\r" not in veneno and "\n" not in veneno
    assert "%0D%0A" in veneno

    # Los acentos sobreviven, codificados: es la única forma de la RFC 6266 que los admite.
    assert _disposicion("informe anual año.pdf").startswith("inline; filename*=UTF-8''")
    assert " " not in _disposicion("informe anual año.pdf").split("''")[1]
