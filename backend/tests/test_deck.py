"""Tests de la presentación generada en diapositivas (/deck), con Sonnet e imagen mockeados."""

import pytest
from fastapi.testclient import TestClient
from pydantic_ai.models.test import TestModel

from multimodal_presenter.api.routes import get_model, get_settings
from multimodal_presenter.config import Settings
from multimodal_presenter.main import app
from multimodal_presenter.pipeline import deck
from multimodal_presenter.schemas.presentation import ILLUSTRATION_LABEL

_FAKE_IMG = "data:image/png;base64,FAKEDECKIMG"


@pytest.fixture(autouse=True)
def _clear():
    deck._cache.clear()
    yield
    app.dependency_overrides.clear()


def _deck_model(input_text: str) -> TestModel:
    # Slide 0: anclada a una cita EXACTA del input_text → verified. Slide 1: síntesis + imagen.
    quote = "La empresa creció de forma sostenida durante la última década."
    assert quote in input_text
    payload = {
        "slides": [
            {"title": "Crecimiento", "bullets": ["Creció una década"], "source_quote": quote},
            {
                "title": "Idea simplificada",
                "bullets": ["Resumen visual"],
                "source_quote": None,
                "synthesis": True,
                "image_prompt": "diagrama del proceso",
            },
        ]
    }
    return TestModel(custom_output_args=payload)


def test_deck_mix_trazabilidad_y_imagen(monkeypatch, input_text: str) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        openai_api_key="sk-test", logfire_token=""
    )
    app.dependency_overrides[get_model] = lambda: _deck_model(input_text)

    async def fake_image(settings, prompt):  # noqa: ANN001 (ARG001)
        return _FAKE_IMG

    monkeypatch.setattr(deck, "_generate_image", fake_image)

    client = TestClient(app)
    r = client.post("/deck", data={"text": input_text})
    assert r.status_code == 200
    slides = r.json()["slides"]
    assert len(slides) == 2

    # Slide 0: anclada a la fuente (verified), no es síntesis, sin imagen.
    assert slides[0]["is_synthesis"] is False
    assert slides[0]["grounding"] == "verified"
    assert slides[0]["source"] is not None

    # Slide 1: síntesis declarada (sin cita) + imagen con etiqueta obligatoria.
    assert slides[1]["is_synthesis"] is True
    assert slides[1]["source"] is None
    assert slides[1]["illustration"]["image_url"] == _FAKE_IMG
    assert slides[1]["illustration"]["label"] == ILLUSTRATION_LABEL


def test_deck_sin_clave_openai_genera_sin_imagenes(monkeypatch, input_text: str) -> None:
    # Sin NINGÚN proveedor de imagen: el deck degrada sin imágenes. Se anulan las TRES claves
    # explícitamente (Gemini es el primario) para no depender del `.env` real de la máquina.
    app.dependency_overrides[get_settings] = lambda: Settings(
        google_api_key=None, openai_api_key=None, ideogram_api_key=None, logfire_token=""
    )
    app.dependency_overrides[get_model] = lambda: _deck_model(input_text)

    async def boom(settings, prompt):  # noqa: ANN001 (ARG001)
        raise AssertionError("no debe generar imagen sin clave")

    monkeypatch.setattr(deck, "_generate_image", boom)

    client = TestClient(app)
    r = client.post("/deck", data={"text": input_text})
    assert r.status_code == 200  # degrada honestamente: deck sin imágenes
    slides = r.json()["slides"]
    assert all(s["illustration"] is None for s in slides)


def test_deck_sobre_audio_lleva_el_momento_de_la_cita(wav_bytes: bytes) -> None:
    """El deck transporta `start_s` igual que las secciones y el chat.

    Sin esto, abrir la fuente desde una diapositiva de un documento de audio arrancaba el
    reproductor en 0:00 en vez de en la cita: la misma fuente se comportaba distinto según la
    vista. También cubre la rama de SÍNTESIS, donde no hay cita y `start_s` debe quedar en None
    (si no se inicializara, esa rama reventaría).
    """
    import asyncio

    from multimodal_presenter.config import get_settings as _get_settings
    from multimodal_presenter.pipeline.extraction import prepare_input
    from multimodal_presenter.schemas.audio import AudioEvidence

    cita = "las ventas subieron un veinte por ciento"
    evidencia = AudioEvidence.model_validate(
        {
            "segments": [
                {
                    "speaker": "hablante 1",
                    "text": cita,
                    "start_s": 4.5,
                    "end_s": 9.0,
                    "emphasis": [],
                    "delivery": "neutro",
                    "pause_before": "ninguna",
                    "confidence": "alta",
                }
            ],
            "non_verbal_events": [],
            "acoustic_context": {
                "quality": "clara",
                "background_noise": "",
                "intelligibility_risk": False,
                "at_risk_items": [],
            },
            "speaker_count": 1,
            "perceived_structure": [],
            "language": "es",
        }
    )
    payload = {
        "slides": [
            {"title": "Con cita", "bullets": ["x"], "source_quote": cita, "synthesis": False},
            {"title": "Síntesis", "bullets": ["y"], "source_quote": None, "synthesis": True},
        ]
    }
    extraction = prepare_input(binary=wav_bytes, media_type="audio/wav", audio_evidence=evidencia)
    ajustes = _get_settings().model_copy(
        update={"google_api_key": None, "ideogram_api_key": None, "openai_api_key": None}
    )
    resultado = asyncio.run(
        deck.generate_deck(TestModel(custom_output_args=payload), ajustes, extraction)
    )

    anclada, sintesis = resultado.slides
    assert anclada.grounding == "unverified"  # audio: se localiza, no se verifica
    assert anclada.start_s == 4.5
    assert sintesis.is_synthesis is True
    assert sintesis.start_s is None


# ── Fase 2: el papel decide la forma, y el presupuesto de imágenes es proporcional ──


@pytest.mark.parametrize(
    ("slides", "esperado"),
    [(1, 2), (4, 2), (8, 2), (12, 3), (14, 4), (20, 5), (60, 5)],
)
def test_el_presupuesto_de_imagenes_crece_con_la_presentacion(slides: int, esperado: int) -> None:
    """Dos imágenes era un número arbitrario, puesto cuando el problema era que sobraban.

    Ahora cada imagen pasa por un filtro que mira el dibujo y descarta las decorativas, así que se
    puede aflojar sin que vuelva la basura. El techo se queda porque una imagen descartada ya se
    pagó, y el suelo también: una presentación corta sin ninguna imagen es un documento.
    """
    assert deck._presupuesto_de_imagenes(slides) == esperado


def test_la_cifra_solo_sobrevive_en_una_diapositiva_de_dato() -> None:
    """El modelo declara el papel y rellena los campos por separado, así que puede dejar una
    cifra en una diapositiva que no es un dato. Si pasara al contrato, el frontend tendría que
    decidir a quién creer; aquí se decide una vez."""
    plan = deck._SlidePlan(papel="afirmacion", title="x", cifra="80 km")
    assert plan.cifra == "80 km"
    assert deck._comparacion(plan) is None


def test_la_comparacion_recorta_a_cuatro_puntos_por_lado() -> None:
    lados = deck._ComparacionPlan(
        izquierda=deck._LadoPlan(titulo="A", puntos=[f"p{i}" for i in range(7)]),
        derecha=deck._LadoPlan(titulo="B", puntos=["q"]),
    )
    plan = deck._SlidePlan(papel="comparacion", title="x", comparacion=lados)
    salida = deck._comparacion(plan)
    assert salida is not None
    assert len(salida.izquierda.puntos) == 4, "cinco puntos no caben en una columna"
    assert salida.derecha.titulo == "B"


def test_una_comparacion_declarada_sin_lados_no_rompe_nada() -> None:
    plan = deck._SlidePlan(papel="comparacion", title="x", comparacion=None)
    assert deck._comparacion(plan) is None


def test_el_plan_no_pone_topes_de_valor_a_ninguna_lamina() -> None:
    """El plan describe la FORMA de la respuesta, nunca cuánto cabe en cada campo.

    Esto invierte la regla que yo mismo fijé aquí antes, y la inversión la pagó producción. El
    razonamiento viejo era bueno a medias: con el tope en el plan, pydantic le devuelve el error
    al modelo y este lo corrige. La mitad que no vi es que el modelo devuelve el deck ENTERO de
    una vez, así que un cuerpo de 70 palabras no invalidaba su lámina, invalidaba las catorce; y
    cuando el reintento volvía a pasarse, saltaba «Exceeded maximum output retries» y /deck
    respondía 500 sin decir por qué.

    Los topes siguen existiendo: los aplica el montaje, lámina a lámina, recortando o
    descartando una sola. Que este test mire el esquema y no el comportamiento es a propósito:
    un `max_length` puesto aquí de buena fe es justo la regresión que nadie ve venir.
    """
    acotados = [
        nombre
        for nombre, campo in deck._SlidePlan.model_fields.items()
        if any(hasattr(m, "max_length") or hasattr(m, "min_length") for m in campo.metadata)
    ]
    assert not acotados, f"el plan acota {acotados}: un campo que se pasa rechaza el deck entero"


def test_un_cuerpo_largo_se_recorta_por_la_ultima_frase_que_cabe() -> None:
    """Y no por el carácter 280, que se leería como un fallo de la aplicación."""
    frase = "Los duendes rojos laten sobre la tormenta. "
    plan = deck._SlidePlan(title="x", body=frase * 10)
    cuerpo = deck._cuerpo(plan)
    assert cuerpo is not None
    assert len(cuerpo) <= deck._BODY_MAX
    assert cuerpo.endswith(".")
    assert cuerpo == (frase * 6).strip()  # seis frases caben en 280; la séptima no


def test_un_cuerpo_sin_un_solo_punto_se_corta_por_palabra_entera() -> None:
    plan = deck._SlidePlan(title="x", body="palabra " * 60)
    cuerpo = deck._cuerpo(plan)
    assert cuerpo is not None
    assert len(cuerpo) <= deck._BODY_MAX + 3  # los puntos suspensivos que avisan del corte
    assert cuerpo.endswith("palabra...")


def test_un_cuerpo_que_cabe_no_se_toca() -> None:
    plan = deck._SlidePlan(title="x", body="  Corta y sana.  ")
    assert deck._cuerpo(plan) == "Corta y sana."
    assert deck._cuerpo(deck._SlidePlan(title="x", body="   ")) is None
    assert deck._cuerpo(deck._SlidePlan(title="x", body=None)) is None


def test_una_cifra_demasiado_larga_no_tumba_la_presentacion() -> None:
    """Segunda red. Lo que llega aquí lo escribió un modelo, y una lámina que no se puede montar
    no puede llevarse por delante las otras trece."""
    plan = deck._SlidePlan.model_construct(
        papel="dato", title="x", cifra="un 15,3 por ciento más", bullets=[]
    )
    assert deck._cifra(plan) is None


def test_la_cifra_no_sobrevive_fuera_de_una_diapositiva_de_dato() -> None:
    plan = deck._SlidePlan(papel="afirmacion", title="x", cifra="80 km")
    assert deck._cifra(plan) is None


def test_una_lamina_que_no_valida_no_se_lleva_la_presentacion(monkeypatch, input_text: str) -> None:
    """La red de seguridad del montaje.

    Lo que llega al montaje lo escribió un modelo, y hasta ahora una sola lámina inválida
    respondía 500 y dejaba al participante sin presentación. Aquí se fuerza ese fallo (una cifra
    imposible, más larga de lo que el contrato admite) y se comprueba que las demás llegan.
    """
    import asyncio

    from multimodal_presenter.config import Settings
    from multimodal_presenter.pipeline.extraction import prepare_input

    payload = {
        "hilo": "lo que defiende",
        "slides": [
            {"papel": "afirmacion", "title": "Primera"},
            {"papel": "dato", "title": "La mala", "cifra": "80 km"},
            {"papel": "afirmacion", "title": "Tercera"},
        ],
    }
    # Devuelve algo que el contrato público NO acepta, saltándose el tope del plan.
    monkeypatch.setattr(deck, "_cifra", lambda plan: "x" * 40 if plan.papel == "dato" else None)

    resultado = asyncio.run(
        deck.generate_deck(
            TestModel(custom_output_args=payload),
            Settings(openai_api_key="", logfire_token=""),
            prepare_input(text=input_text),
        )
    )

    assert [s.title for s in resultado.slides] == ["Primera", "Tercera"]
    assert resultado.hilo == "lo que defiende"


# ── La evidencia pasa por la MISMA regla que el contenido del documento ──


def _grafico(tipo: str, valores: list[float]) -> dict:
    return {
        "content_type": "chart",
        "chart_type": tipo,
        "data": {"categories": ["a", "b"], "series": [{"name": "s", "values": valores}]},
    }


def test_sin_evidencia_no_hay_evidencia() -> None:
    assert deck._evidencia(deck._SlidePlan(title="x")) is None


def test_la_evidencia_pasa_por_la_regla_de_isomorfismo() -> None:
    """Esto es lo que hace COMPROBABLE una presentación generada, y no solo bonita.

    Un gráfico que el modelo propone cruza el mismo filtro determinista que el contenido del
    documento. Si el tipo no representa esos datos se corrige solo; si ninguno los representa, se
    degrada a tabla. Es la diferencia con las herramientas que generan presentaciones dibujando
    imágenes: allí la evidencia es un dibujo y no hay con qué contrastarlo.
    """
    from multimodal_presenter.schemas.presentation import ChartContent

    # Una tarta con un valor negativo no es representable como tarta.
    plan = deck._SlidePlan.model_validate({"title": "x", "evidencia": _grafico("pie", [-1, 2])})
    salida = deck._evidencia(plan)

    assert salida is not None
    if isinstance(salida, ChartContent):
        assert salida.chart_type != "pie", "se corrigió a un tipo que sí representa los datos"
    else:
        assert salida.content_type == "table", "o se degradó a tabla, que también es honesto"


def test_un_grafico_ya_correcto_se_queda_como_esta() -> None:
    plan = deck._SlidePlan.model_validate({"title": "x", "evidencia": _grafico("bar", [1, 2])})
    salida = deck._evidencia(plan)
    assert salida is not None and salida.content_type == "chart"
    assert salida.chart_type == "bar"


def test_una_lamina_con_cuerpo_largo_no_tumba_la_presentacion(input_text: str) -> None:
    """El fallo de producción, tal como ocurrió, desde la petición.

    El plan acotaba el cuerpo a 280 caracteres. Como el modelo devuelve el deck entero de una
    vez, una lámina de 70 palabras invalidaba la respuesta COMPLETA; pydantic se la devolvía
    para que la corrigiera, el modelo volvía a pasarse y a la segunda saltaba
    «Exceeded maximum output retries». /deck respondía 500 y el participante se quedaba sin
    presentación, con un registro que no nombraba la causa.
    """
    app.dependency_overrides[get_settings] = lambda: Settings(openai_api_key="", logfire_token="")
    largo = "Los duendes rojos laten sobre la tormenta y se apagan en milisegundos. " * 7
    assert len(largo) > deck._BODY_MAX
    payload = {
        "hilo": "un hilo",
        "slides": [
            {"papel": "afirmacion", "title": "Corta", "body": "Cabe de sobra.", "synthesis": True},
            {"papel": "afirmacion", "title": "Pasada", "body": largo, "synthesis": True},
        ],
    }
    app.dependency_overrides[get_model] = lambda: TestModel(custom_output_args=payload)

    r = TestClient(app).post("/deck", data={"text": input_text})

    assert r.status_code == 200
    slides = r.json()["slides"]
    assert [s["title"] for s in slides] == ["Corta", "Pasada"]
    assert len(slides[1]["body"]) <= deck._BODY_MAX
    assert slides[1]["body"].endswith(".")


def test_si_el_modelo_falla_el_deck_responde_un_error_con_nombre(input_text: str) -> None:
    """Un 502 con mensaje, no un 500 pelado.

    Lo que convirtió el fallo anterior en dos días de conjeturas no fue el fallo: fue que el
    registro guardaba una traza de pydantic y ni una palabra sobre qué fase ni qué fuente.
    """
    app.dependency_overrides[get_settings] = lambda: Settings(openai_api_key="", logfire_token="")

    class _Roto(TestModel):
        async def request(self, *args, **kwargs):  # noqa: ANN002, ANN003, ANN201
            raise RuntimeError("el proveedor dijo no")

    app.dependency_overrides[get_model] = lambda: _Roto()

    r = TestClient(app).post("/deck", data={"text": input_text})

    assert r.status_code == 502
    assert r.json()["detail"] == "No se pudo generar la presentación."


def test_el_esquema_del_plan_lo_acepta_cada_proveedor_del_fallback() -> None:
    """El plan viaja como definición de herramienta, y cada proveedor lo reescribe a su gusto.

    Gemini es el estricto de los dos, y es el fallback: si rechaza el esquema o se come un campo
    al transformarlo, nadie se entera hasta el día que Anthropic se cae, que es el único día en
    que el fallback importa. `evidencia` es el campo en riesgo porque es una unión discriminada,
    la construcción que peor se lleva con los esquemas de función.

    No toca la red: `customize_request_parameters` transforma el esquema en local, y las claves
    son falsas a propósito para que esto corra en un CI sin secretos.
    """
    import json

    from pydantic_ai.models import ModelRequestParameters
    from pydantic_ai.models.anthropic import AnthropicModel
    from pydantic_ai.models.google import GoogleModel
    from pydantic_ai.providers.anthropic import AnthropicProvider
    from pydantic_ai.providers.google import GoogleProvider
    from pydantic_ai.tools import ToolDefinition

    esquema = deck._DeckPlan.model_json_schema()
    modelos = {
        "anthropic": AnthropicModel(
            "claude-sonnet-5", provider=AnthropicProvider(api_key="sk-ant-falsa")
        ),
        "google": GoogleModel("gemini-3.1-pro-preview", provider=GoogleProvider(api_key="falsa")),
    }

    for nombre, modelo in modelos.items():
        params = ModelRequestParameters(
            output_tools=[
                ToolDefinition(name="final_result", parameters_json_schema=dict(esquema))
            ],
            allow_text_output=False,
        )
        transformado = json.dumps(
            [
                t.parameters_json_schema
                for t in modelo.customize_request_parameters(params).output_tools
            ]
        )
        for campo in ("hilo", "papel", "cifra", "comparacion", "evidencia"):
            assert campo in transformado, f"{nombre} se come `{campo}` al transformar el esquema"


def test_un_dato_sin_titulo_no_pierde_su_cifra() -> None:
    """El caso que se vio con el PDF de los duendes, y que yo mismo provoqué.

    El prompt le prohíbe repetir la cifra en el título (porque repetirla gastaba la lámina), y
    el modelo tomó el camino seguro: dejó el título en blanco. El contrato exige título, así que
    la lámina se descartaba entera y con ella el número, que era todo lo que tenía.
    """
    plan = deck._SlidePlan(
        papel="dato",
        title="",
        cifra="50 a 90 km",
        body="Ahí ocurre el duende rojo: más alto que cualquier avión. Y por eso casi nadie lo ve.",
    )
    titulo, cuerpo = deck._titulo_y_cuerpo(plan)
    assert titulo == "Ahí ocurre el duende rojo: más alto que cualquier avión."
    assert cuerpo == "Y por eso casi nadie lo ve."  # la frase ascendida sale del cuerpo


def test_un_titulo_escrito_se_respeta_tal_cual() -> None:
    plan = deck._SlidePlan(title="  Lo que el número sostiene  ", body="La glosa.")
    assert deck._titulo_y_cuerpo(plan) == ("Lo que el número sostiene", "La glosa.")


def test_un_cuerpo_de_una_sola_frase_asciende_entero_y_deja_el_cuerpo_vacio() -> None:
    plan = deck._SlidePlan(title="", body="Una sola idea y punto.")
    assert deck._titulo_y_cuerpo(plan) == ("Una sola idea y punto.", None)


def test_una_lamina_sin_titulo_ni_cuerpo_no_se_puede_salvar() -> None:
    """Y debe descartarse: no hay de dónde sacar un título, y una lámina en blanco es peor."""
    assert deck._titulo_y_cuerpo(deck._SlidePlan(title="", body=None)) == ("", None)
