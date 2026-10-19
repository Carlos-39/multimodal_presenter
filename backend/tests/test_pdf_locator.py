"""Localizador de regiones en PDF (F1), la escalera de matching y la degradación honesta.

Lo que estos tests fijan, por orden de importancia:

1. **Que degrada, nunca falla.** Una cita que no se encuentra devuelve `calidad: "page"`, que
   es el comportamiento que el sistema ya tenía. Es lo que permite activar esto sin arriesgar
   nada de lo que ya funciona.
2. **Que no inventa precisión.** Un recuadro equivocado es peor que ningún recuadro: señalaría
   con confianza un sitio que no es. Por eso hay tests de las reglas de contención y del umbral.
3. **Que la geometría aguanta los dos casos que el spike marcó como riesgo**: páginas rotadas y
   citas que cruzan un salto de columna.

Los PDFs se construyen aquí, con una línea por `cell`, para controlar EXACTAMENTE dónde cae cada
salto de renglón; con ajuste automático no se podría probar el guion de corte. Son sintéticos y
deterministas, así que la suite no depende de ningún archivo local.
"""

from __future__ import annotations

import io
import pathlib

import matplotlib
import pypdf
import pytest
from fpdf import FPDF

from multimodal_presenter.pipeline.pdf_locator import (
    MAX_LINEAS,
    Localizacion,
    PdfLocator,
    _normalizar,
)

_TTF = pathlib.Path(matplotlib.get_data_path()) / "fonts" / "ttf" / "DejaVuSans.ttf"


def _pdf(lineas: list[str], *, paginas_extra: int = 0) -> bytes:
    """PDF de una línea por renglón, en puntos, con fuente Unicode real.

    DejaVu (no Helvetica) porque las comillas tipográficas y los guiones largos no existen en
    latin-1, y son justo lo que hay que probar.
    """
    pdf = FPDF(unit="pt", format="A4")
    pdf.add_font("dejavu", "", str(_TTF))
    pdf.set_font("dejavu", size=11)
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    for linea in lineas:
        pdf.cell(0, 16, linea, new_x="LMARGIN", new_y="NEXT")
    for _ in range(paginas_extra):
        pdf.add_page()
        pdf.cell(0, 16, "Pagina de relleno sin relacion con lo anterior.", new_x="LMARGIN")
    return bytes(pdf.output())


def _pdf_dos_columnas(izquierda: list[str], derecha: list[str]) -> bytes:
    """Dos columnas de verdad: la izquierda termina y la derecha empieza arriba otra vez."""
    pdf = FPDF(unit="pt", format="A4")
    pdf.add_font("dejavu", "", str(_TTF))
    pdf.set_font("dejavu", size=11)
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    for i, linea in enumerate(izquierda):
        pdf.set_xy(40, 60 + i * 16)
        pdf.cell(230, 16, linea)
    for i, linea in enumerate(derecha):
        pdf.set_xy(320, 60 + i * 16)
        pdf.cell(230, 16, linea)
    return bytes(pdf.output())


def _rotar(pdf: bytes, grados: int) -> bytes:
    lector = pypdf.PdfReader(io.BytesIO(pdf))
    escritor = pypdf.PdfWriter()
    for pagina in lector.pages:
        pagina.rotate(grados)
        escritor.add_page(pagina)
    salida = io.BytesIO()
    escritor.write(salida)
    return salida.getvalue()


TEXTO = [
    "Los duendes rojos son descargas electricas que ocurren sobre las tormentas.",
    "La mesosfera se extiende entre los cincuenta y los noventa kilometros de",
    "altura sobre la superficie terrestre, muy por encima de los aviones.",
    "El fenomeno se documento por primera vez en mil novecientos ochenta y nueve.",
]


@pytest.fixture
def localizador():
    with PdfLocator(_pdf(TEXTO)) as loc:
        yield loc


# ─────────────────────────────────────────────────────────────
# La escalera
# ─────────────────────────────────────────────────────────────
def test_cita_exacta_en_un_renglon(localizador) -> None:
    r = localizador.localizar("descargas electricas que ocurren", 1)
    assert r.calidad == "exact"
    assert len(r.regiones) == 1


def test_cita_que_cruza_un_salto_de_renglon(localizador) -> None:
    """Un recuadro POR RENGLÓN, nunca uno gigante que abarque los dos y lo de en medio."""
    r = localizador.localizar(
        "entre los cincuenta y los noventa kilometros de altura sobre la superficie", 1
    )
    assert r.calidad == "exact"
    assert len(r.regiones) == 2
    primera, segunda = r.regiones
    assert segunda.y0 > primera.y0  # la segunda va debajo
    # El primer renglón termina en el margen derecho y el segundo empieza en el izquierdo:
    # si se hubieran fundido, habría UNA región alta que cubre ambas.
    assert primera.y1 <= segunda.y0 + 0.01


def test_comillas_tipograficas_y_tildes_siguen_siendo_exactas() -> None:
    """El modelo cita con comillas rectas lo que el PDF trae con comillas tipográficas."""
    pdf = _pdf(["La NASA lo llama un fenomeno “frio” porque no transporta calor."])
    with PdfLocator(pdf) as loc:
        r = loc.localizar('lo llama un fenomeno "frio" porque', 1)
    assert r.calidad == "exact"
    assert len(r.regiones) == 1


def test_guion_de_corte_de_linea() -> None:
    """En el PDF la palabra está partida; el modelo la cita entera."""
    pdf = _pdf(["El estudio midio la biodiver-", "sidad de la region durante dos anios."])
    with PdfLocator(pdf) as loc:
        r = loc.localizar("midio la biodiversidad de la region", 1)
    assert r.calidad == "exact"
    assert len(r.regiones) == 2  # sigue estando en dos renglones


def test_parafrasis_cercana_cae_en_aproximada(localizador) -> None:
    """Supera el umbral: se señala la zona, pero se declara que es aproximada."""
    r = localizador.localizar(
        "La mesosfera se extiende entre los cincuenta y noventa kilometros de altura sobre la "
        "superficie",
        1,
    )
    assert r.calidad == "approximate"
    assert r.regiones


def test_parafrasis_lejana_degrada_a_pagina(localizador) -> None:
    """No supera el umbral: mejor sin recuadro que con uno que señale mal."""
    r = localizador.localizar(
        "La mesosfera va de cincuenta a noventa kilometros por encima del suelo terrestre", 1
    )
    assert r.calidad == "page"
    assert r.regiones == ()


def test_cita_inexistente_degrada_limpio(localizador) -> None:
    r = localizador.localizar("El precio del cafe subio un quince por ciento en el trimestre", 1)
    assert r.calidad == "page"
    assert r.regiones == ()


# ─────────────────────────────────────────────────────────────
# Degradación: nunca falla, siempre devuelve algo usable
# ─────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("cita", "pagina"),
    [
        ("", 1),  # cita vacía
        ("   ", 1),  # solo espacios
        ("descargas electricas", 0),  # página fuera de rango (por abajo)
        ("descargas electricas", 99),  # página fuera de rango (por arriba)
        ("descargas electricas", -3),  # página absurda
    ],
)
def test_entradas_imposibles_degradan_sin_lanzar(localizador, cita: str, pagina: int) -> None:
    r = localizador.localizar(cita, pagina)
    assert r.calidad == "page"
    assert r.regiones == ()


def test_pagina_sin_capa_de_texto_degrada() -> None:
    """El caso de los PDFs escaneados: decisión de alcance declarada, no un error."""
    pdf = _pdf(TEXTO, paginas_extra=1)
    with PdfLocator(pdf) as loc:
        vacia = loc.localizar("cualquier cosa", 2)
    assert vacia.calidad == "page"


def test_pasaje_demasiado_largo_degrada() -> None:
    """Un recuadro que abarca media página no señala nada: es más honesto no dibujarlo."""
    lineas = [
        f"Renglon numero {i} con texto suficiente para ocupar el ancho de la pagina."
        for i in range(MAX_LINEAS + 6)
    ]
    pdf = _pdf(lineas)
    with PdfLocator(pdf) as loc:
        r = loc.localizar(" ".join(lineas), 1)
    assert r.calidad == "page"
    assert r.regiones == ()


# ─────────────────────────────────────────────────────────────
# Geometría: los dos riesgos que marcó el spike
# ─────────────────────────────────────────────────────────────
def test_las_regiones_caen_dentro_de_la_pagina(localizador) -> None:
    r = localizador.localizar("descargas electricas que ocurren sobre las tormentas", 1)
    for region in r.regiones:
        assert 0.0 <= region.x0 < region.x1 <= 1.0
        assert 0.0 <= region.y0 < region.y1 <= 1.0


@pytest.mark.parametrize("grados", [180, 270])
def test_pagina_rotada_sigue_localizando(grados: int) -> None:
    """La primera versión daba 78 recuadros en vez de 2 con la página rotada.

    El agrupado se hace en coordenadas de PÁGINA justamente por esto: `/Rotate` es presentación,
    y en la página el texto siempre avanza igual.
    """
    with PdfLocator(_rotar(_pdf(TEXTO), grados)) as loc:
        r = loc.localizar(
            "entre los cincuenta y los noventa kilometros de altura sobre la superficie", 1
        )
    assert r.calidad == "exact"
    assert len(r.regiones) == 2  # dos renglones, igual que sin rotar
    for region in r.regiones:
        assert 0.0 <= region.x0 < region.x1 <= 1.0
        assert 0.0 <= region.y0 < region.y1 <= 1.0


def test_rotacion_90_una_sola_linea_funciona() -> None:
    """Con `/Rotate 90` la GEOMETRÍA es correcta: el recuadro cae donde debe."""
    with PdfLocator(_rotar(_pdf(TEXTO), 90)) as loc:
        r = loc.localizar("descargas electricas que ocurren", 1)
    assert r.calidad == "exact"
    assert len(r.regiones) == 1
    region = r.regiones[0]
    assert 0.0 <= region.x0 < region.x1 <= 1.0
    assert 0.0 <= region.y0 < region.y1 <= 1.0


def test_rotacion_90_varias_lineas_degrada_en_vez_de_mentir() -> None:
    """Limitación REAL medida, no supuesta: con `/Rotate 90` pdfium extrae los renglones en orden
    inverso al visual (se comprobó también con texto fluido, no es cosa del PDF sintético).

    El modelo cita siguiendo el orden que VE, así que una cita de varias líneas deja de ser
    contigua en la capa de texto y no casa. Lo que importa es que eso degrada a fidelidad de
    página (el comportamiento de siempre) en vez de producir un recuadro en el sitio equivocado.
    Es el mismo criterio de todo el módulo: antes sin recuadro que con uno que señale mal.
    """
    with PdfLocator(_rotar(_pdf(TEXTO), 90)) as loc:
        r = loc.localizar(
            "entre los cincuenta y los noventa kilometros de altura sobre la superficie", 1
        )
    assert r.calidad == "page"
    assert r.regiones == ()


def test_cita_que_cruza_un_salto_de_columna_no_funde_las_regiones() -> None:
    """El riesgo propio de agrupar a mano: unir el final de una columna con el inicio de la otra.

    Agrupar por "altura parecida" las fundiría, porque la última línea de la izquierda y la
    primera de la derecha están a alturas distintas pero el recuadro resultante cruzaría toda la
    página. La regla real es "la pluma saltó", que aquí corta bien.
    """
    pdf = _pdf_dos_columnas(
        ["Primera columna con su", "contenido propio y el", "cierre de la seccion."],
        ["Segunda columna que", "continua el documento", "despues del salto."],
    )
    with PdfLocator(pdf) as loc:
        r = loc.localizar("y el cierre de la seccion. Segunda columna que", 1)
    assert r.calidad == "exact"
    # Tres renglones: el final del segundo de la izquierda, el tercero, y el primero de la derecha.
    assert len(r.regiones) == 3
    # Ninguna región cruza la página entera: eso sería la fusión que se quiere evitar.
    for region in r.regiones:
        assert region.x1 - region.x0 < 0.6


# ─────────────────────────────────────────────────────────────
# La normalización, aislada
# ─────────────────────────────────────────────────────────────
def test_el_mapa_de_indices_apunta_al_original() -> None:
    """Es lo que permite comparar texto cómodo sin perder a qué carácter corresponde cada caja."""
    original = "uno  dos\r\ntres"
    norm, mapa = _normalizar(original)
    assert norm == "uno dos tres"
    assert len(mapa) == len(norm)
    for i, c in enumerate(norm):
        if c != " ":
            assert original[mapa[i]] == c


def test_la_normalizacion_no_toca_las_mayusculas() -> None:
    """Mismo criterio que el grounding de texto plano: unificar mayúsculas sería semántica."""
    norm, _ = _normalizar("La NASA")
    assert norm == "La NASA"


# ─────────────────────────────────────────────────────────────
# Citas con elipsis: lo que el modelo hace de verdad
# ─────────────────────────────────────────────────────────────
def test_una_cita_con_elipsis_se_busca_por_fragmentos(localizador) -> None:
    """Caso encontrado verificando con un documento real, no inventado.

    El modelo elide la parte de en medio muy a menudo. Buscada entera, esa cita puntuaba 78
    frente al umbral de 90 y se perdía una localización que era exacta. Partirla por la elipsis
    no relaja el criterio: la elipsis DICE que ahí hay un hueco, así que recuadrar los dos
    trozos sin lo de en medio es más fiel que un recuadro único que lo abarcaría todo.
    """
    r = localizador.localizar("Los duendes rojos son descargas... La mesosfera se extiende", 1)
    assert r.calidad == "exact"
    assert len(r.regiones) == 2  # un trozo en cada renglón, sin lo de en medio


def test_los_fragmentos_se_buscan_en_orden(localizador) -> None:
    """ "A ... B" significa que B va DESPUÉS de A: al revés no debe casar."""
    al_derecho = localizador.localizar("son descargas electricas... El fenomeno se documento", 1)
    al_reves = localizador.localizar("El fenomeno se documento... son descargas electricas", 1)
    assert al_derecho.calidad == "exact"
    assert al_reves.calidad == "page"


def test_un_fragmento_demasiado_corto_no_se_busca_suelto(localizador) -> None:
    """Un trozo de tres letras casa en cualquier parte; recuadrar un sitio cualquiera es peor."""
    from multimodal_presenter.pipeline.pdf_locator import _fragmentos_de_cita

    assert _fragmentos_de_cita("son... La mesosfera se extiende entre los cincuenta") == [
        "La mesosfera se extiende entre los cincuenta"
    ]


def test_tambien_con_corchetes_y_puntos_suspensivos_tipograficos(localizador) -> None:
    for marca in ("[...]", "…", "[…]"):
        r = localizador.localizar(f"Los duendes rojos son descargas {marca} La mesosfera", 1)
        assert r.calidad == "exact", marca


# ─────────────────────────────────────────────────────────────
# Páginas vecinas: el número impreso no siempre es el físico
# ─────────────────────────────────────────────────────────────
@pytest.fixture
def tres_paginas() -> bytes:
    """Un documento donde cada página tiene una frase propia e inconfundible."""
    return _pdf_por_paginas(
        [
            ["Portada del informe anual sin contenido relevante."],
            TEXTO,
            ["Anexo final con referencias bibliograficas diversas."],
        ]
    )


def _pdf_por_paginas(paginas: list[list[str]]) -> bytes:
    pdf = FPDF(unit="pt", format="A4")
    pdf.add_font("dejavu", "", str(_TTF))
    pdf.set_font("dejavu", size=11)
    pdf.set_auto_page_break(auto=False)
    for lineas in paginas:
        pdf.add_page()
        for linea in lineas:
            pdf.cell(0, 16, linea, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


@pytest.mark.parametrize("dijo_el_modelo", [1, 2, 3])
def test_encuentra_la_cita_aunque_el_modelo_yerre_la_pagina(
    tres_paginas: bytes, dijo_el_modelo: int
) -> None:
    """El desfase entre el número impreso y el físico es común, y el modelo cita el impreso."""
    with PdfLocator(tres_paginas) as loc:
        r = loc.localizar("descargas electricas que ocurren sobre las tormentas", dijo_el_modelo)
    assert r.calidad == "exact"
    assert r.pagina == 2, "la cita está en la 2 aunque se pidiera otra"
    assert r.regiones


def test_no_busca_mas_alla_de_las_vecinas(tres_paginas: bytes) -> None:
    """Solo ±1. Buscar por todo el documento convertiría un error de página en una búsqueda
    global, y entonces un recuadro ya no diría nada sobre si el modelo acertó."""
    pdf = _pdf_por_paginas(
        [["Relleno uno."], ["Relleno dos."], ["Relleno tres."], ["Relleno cuatro."], TEXTO]
    )
    with PdfLocator(pdf) as loc:
        r = loc.localizar("descargas electricas que ocurren sobre las tormentas", 1)
    assert r.calidad == "page"
    assert r.regiones == ()


def test_los_recuadros_viajan_con_su_pagina(localizador) -> None:
    """Sin esto se podrían dibujar sobre la página equivocada."""
    r = localizador.localizar("descargas electricas que ocurren", 1)
    assert r.pagina == 1
    assert Localizacion.solo_pagina().pagina is None


def test_en_una_vecina_no_vale_un_parecido_difuso(tres_paginas: bytes) -> None:
    """Dos incertidumbres a la vez (página que no es + parecido) no se acumulan: se degrada.

    La misma cita aproximada SÍ se acepta en la página que el modelo citó, así que lo que se
    está midiendo es exactamente la diferencia de criterio entre una página y otra.
    """
    aproximada = (
        "La mesosfera se extiende entre los cincuenta y noventa kilometros de altura "
        "sobre la superficie"
    )
    with PdfLocator(tres_paginas) as loc:
        en_la_suya = loc.localizar(aproximada, 2)
        en_la_vecina = loc.localizar(aproximada, 1)
    assert en_la_suya.calidad == "approximate"
    assert en_la_vecina.calidad == "page"
