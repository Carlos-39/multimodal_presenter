"""Localizador de regiones en PDF — dónde está, físicamente, una cita ya generada.

Sube el PDF de **fidelidad de página** (Hito 5c: "te llevo a la página 7") a **fidelidad de
región** ("está AQUÍ, en este recuadro"). Es el cuarto nivel del mismo esquema honesto que ya
usan el texto (fidelidad exacta por offsets) y el audio (fidelidad de momento, A1).

**La tensión con "nunca aplanar", resuelta.** El principio rector dice que el documento no se
aplana a texto antes de dárselo al modelo. Este módulo no lo viola, y la razón es estructural, no
una promesa: corre **después** de que la generación terminó, sobre una cita **que el modelo ya
escribió**, y su única salida son coordenadas. El LLM sigue recibiendo el PDF binario nativo y
nunca ve nada de lo que hay aquí. Aplanar para que el MODELO interprete sería sustituir la fuente
por un derivado; extraer geometría para que el LECTOR verifique es lo contrario: aumenta la
trazabilidad de lo que el modelo ya dijo.

**Localizar ≠ verificar** (mismo criterio que `start_s` en audio, A1). Encontrar la cita en la
capa de texto NO cambia el estado de grounding: sigue siendo `unverified`. Lo que se gana es
poder señalar dónde mirar, no una afirmación de que el contenido quedó verificado.

**Alcance declarado, no limitación oculta:** solo PDFs con capa de texto nativa. Los escaneados
(sin texto extraíble) degradan a `calidad: "pagina"` — exactamente el comportamiento de hoy. No
se hace OCR: es una decisión de alcance consciente.
"""

from __future__ import annotations

import ctypes
from dataclasses import dataclass
from typing import Literal

import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_raw
from rapidfuzz import fuzz

from .validation import CANON_MAP

Calidad = Literal["exacta", "aproximada", "pagina"]
"""Nivel de fidelidad alcanzado al localizar la cita en la página.

- `exacta`     → la cita está, literal (salvo variantes tipográficas y de espaciado).
- `aproximada` → se encontró un pasaje muy parecido; el recuadro señala una zona, no la frase.
- `pagina`     → no se pudo localizar. Es el comportamiento de siempre, no un error.
"""

# Umbral del peldaño difuso. La investigación daba 85-90 y se toma el extremo CONSERVADOR: en
# este proyecto un recuadro equivocado es peor que ningún recuadro, porque señalaría con
# confianza un sitio que no es — justo la sobre-afirmación que eliminó el Hito 8A.1. Una cita
# fiel con diferencias menores puntúa 93-100; una paráfrasis real baja de 85, así que 90 separa
# bien los dos casos sin quedarse corto.
UMBRAL_DIFUSO = 90.0

# Reglas de contención: un recuadro que abarca media página no señala nada, solo da una falsa
# sensación de precisión. Si el pasaje hallado es así de grande, es más honesto degradar.
MAX_LINEAS = 12
MAX_FRACCION_AREA = 0.40

# Por debajo de esto la página no tiene capa de texto utilizable (escaneada, o solo imágenes):
# no hay nada que localizar y se degrada limpio, sin intentarlo.
MIN_CHARS_CAPA_TEXTO = 40

# Guiones que parten una palabra al final del renglón. Se eliminan junto con el salto de línea
# para que "docu-\nmento" case con "documento", que es como lo cita el modelo.
_GUIONES_DE_CORTE = {"-", "­", "‐", "‑"}

# pdfium marca con U+FFFE el punto donde QUITÓ un guion de corte. Un salto de renglón normal sale
# como "\r\n", pero "biodiver-\nsidad" sale como "biodiver<U+FFFE>sidad", ya SIN el guion: el motor
# des-hifena por su cuenta. Lo único que hay que hacer es no tratar esa marca ni como carácter ni
# como espacio, o la palabra quedaría partida otra vez. Medido, no leído en la documentación.
_MARCAS_DE_UNION = {"￾", "￿"}

# Factor para pedirle coordenadas al motor con resolución de sobra antes de normalizar a 0-1.
_PRECISION = 100


@dataclass(frozen=True)
class Region:
    """Un recuadro, en coordenadas NORMALIZADAS 0-1 sobre la página tal como se ve.

    Origen arriba-izquierda y página **ya rotada**: el frontend solo multiplica por el tamaño de
    su contenedor y posiciona en porcentaje. Nunca calcula escalas ni aplica rotaciones — todo
    eso se resolvió aquí, con el mismo motor que dibuja la página.
    """

    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def area(self) -> float:
        return max(0.0, self.x1 - self.x0) * max(0.0, self.y1 - self.y0)


@dataclass(frozen=True)
class Localizacion:
    """Resultado de localizar una cita en una página."""

    calidad: Calidad
    regiones: tuple[Region, ...] = ()

    @classmethod
    def solo_pagina(cls) -> Localizacion:
        """Degradación honesta: se sabe la página, no el sitio dentro de ella."""
        return cls(calidad="pagina", regiones=())


def _normalizar(texto: str) -> tuple[str, list[int]]:
    """Normaliza el texto y devuelve (texto normalizado, mapa índice_normalizado → original).

    El mapa es lo que permite que la escalera entera trabaje sobre una cadena cómoda y aun así
    sepa a qué carácter —y por tanto a qué caja— corresponde cada posición. Sin él habría que
    elegir entre comparar texto sucio o perder la geometría.

    Tres normalizaciones, y ninguna toca la semántica:
    1. Puntuación canónica (`CANON_MAP`, la misma del grounding de texto plano).
    2. Espacios en blanco colapsados a uno solo: en un PDF un renglón termina en `\\r\\n` donde la
       cita del modelo lleva un espacio.
    3. Guion de corte de línea eliminado: "docu-\\n mento" → "documento".
    """
    # El mapa es 1 carácter → 1 carácter, así que los índices siguen valiendo sobre el original.
    canon = texto.translate(CANON_MAP)
    salida: list[str] = []
    mapa: list[int] = []
    i, n = 0, len(canon)
    pegar = False  # venimos de un guion de corte: lo que sigue se une sin espacio
    while i < n:
        c = canon[i]
        if c in _MARCAS_DE_UNION:
            i += 1  # el motor ya unió la palabra: ni carácter ni espacio
            continue
        if c in _GUIONES_DE_CORTE and i + 1 < n and canon[i + 1] in "\r\n":
            pegar = True
            i += 1
            continue
        if c.isspace():
            j = i
            while j < n and canon[j].isspace():
                j += 1
            if not pegar and salida:
                salida.append(" ")
                mapa.append(i)
            pegar = False
            i = j
            continue
        pegar = False
        salida.append(c)
        mapa.append(i)
        i += 1
    while salida and salida[-1] == " ":
        salida.pop()
        mapa.pop()
    return "".join(salida), mapa


def _rango_normalizado(texto_norm: str, cita_norm: str) -> tuple[int, int, Calidad] | None:
    """La escalera de matching, sobre el texto ya normalizado.

    Exacto primero (barato y el caso común), difuso después. El peldaño canónico no aparece como
    un paso aparte porque ya está dentro de la normalización: aquí "exacto" significa exacto
    salvo variantes tipográficas y espaciado, que es el mismo criterio del grounding de texto.
    No se pasa a minúsculas, igual que allí: unificar mayúsculas sería tocar la semántica.
    """
    if not cita_norm:
        return None

    idx = texto_norm.find(cita_norm)
    if idx != -1:
        return idx, idx + len(cita_norm), "exacta"

    alineacion = fuzz.partial_ratio_alignment(cita_norm, texto_norm)
    if alineacion is None or alineacion.score < UMBRAL_DIFUSO:
        return None
    inicio, fin = alineacion.dest_start, alineacion.dest_end
    if fin <= inicio:
        return None
    return inicio, fin, "aproximada"


def _agrupar_en_lineas(
    cajas: list[tuple[float, float, float, float]],
) -> list[list[float]]:
    """Agrupa cajas de caracteres en una caja por RENGLÓN, recorriéndolas en orden de lectura.

    Se trabaja en coordenadas de PÁGINA a propósito. Ahí el texto siempre avanza de izquierda a
    derecha a altura constante, pase lo que pase con `/Rotate`, que es solo un atributo de
    presentación. Agrupar sobre la página ya dibujada fallaba con páginas rotadas: el renglón
    avanza en vertical y cada carácter parecía un renglón nuevo (se midió: 78 recuadros en vez
    de 2).

    El corte no es "altura parecida" —eso fundiría la última línea de una columna con la primera
    de la siguiente, que comparten altura— sino "la pluma saltó": cambió de renglón, o retrocedió
    a la izquierda. Un salto de columna hace las dos cosas, así que queda cortado igual.
    """
    if not cajas:
        return []
    lineas: list[list[float]] = []
    actual = list(cajas[0])
    for izq, abajo, der, arriba in cajas[1:]:
        alto = max(1.0, actual[3] - actual[1])
        centro_actual = (actual[1] + actual[3]) / 2
        centro_nuevo = (abajo + arriba) / 2
        salta_renglon = abs(centro_nuevo - centro_actual) > alto * 0.6
        retrocede = izq < actual[0] - alto
        if salta_renglon or retrocede:
            lineas.append(actual)
            actual = [izq, abajo, der, arriba]
        else:
            actual[0] = min(actual[0], izq)
            actual[1] = min(actual[1], abajo)
            actual[2] = max(actual[2], der)
            actual[3] = max(actual[3], arriba)
    lineas.append(actual)
    return lineas


class PdfLocator:
    """Abre un PDF una vez y localiza en él las citas que el modelo ya produjo.

    Es un gestor de contexto porque el documento guarda recursos nativos que hay que soltar.
    """

    def __init__(self, pdf: bytes) -> None:
        self._doc = pdfium.PdfDocument(pdf)

    def __enter__(self) -> PdfLocator:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self._doc.close()

    @property
    def paginas(self) -> int:
        return len(self._doc)

    def localizar(self, cita: str, pagina: int) -> Localizacion:
        """Localiza `cita` en la página `pagina` (1-based, como `SourceReference.page`).

        Nunca lanza: cualquier cosa que no se pueda localizar degrada a `calidad: "pagina"`, que
        es el comportamiento que el sistema ya tenía. Una cita sin recuadro no rompe nada; un
        recuadro equivocado sí rompería la confianza, que es lo que este proyecto cuida.
        """
        if not cita or not cita.strip():
            return Localizacion.solo_pagina()
        indice = pagina - 1
        if indice < 0 or indice >= len(self._doc):
            return Localizacion.solo_pagina()

        try:
            page = self._doc[indice]
            textpage = page.get_textpage()
            total = textpage.count_chars()
            if total < MIN_CHARS_CAPA_TEXTO:
                return Localizacion.solo_pagina()  # sin capa de texto: nada que localizar

            texto = textpage.get_text_range()
            texto_norm, mapa = _normalizar(texto)
            cita_norm, _ = _normalizar(cita)
            hallado = _rango_normalizado(texto_norm, cita_norm)
            if hallado is None:
                return Localizacion.solo_pagina()
            ini_norm, fin_norm, calidad = hallado

            # De vuelta a índices del texto original, que son los mismos de las cajas.
            ini = mapa[ini_norm]
            fin = mapa[min(fin_norm, len(mapa)) - 1] + 1

            cajas: list[tuple[float, float, float, float]] = []
            for i in range(ini, min(fin, total)):
                izq, abajo, der, arriba = textpage.get_charbox(i)
                if der <= izq or arriba <= abajo:
                    continue  # espacios y caracteres sin geometría propia
                cajas.append((izq, abajo, der, arriba))

            lineas = _agrupar_en_lineas(cajas)
            if not lineas:
                return Localizacion.solo_pagina()
            if len(lineas) > MAX_LINEAS:
                return Localizacion.solo_pagina()  # abarca demasiado: no señala nada

            regiones = tuple(self._a_regiones(page, lineas))
            if not regiones:
                return Localizacion.solo_pagina()
            if sum(r.area for r in regiones) > MAX_FRACCION_AREA:
                return Localizacion.solo_pagina()
            return Localizacion(calidad=calidad, regiones=regiones)
        except Exception:  # noqa: BLE001 — un PDF roto degrada, no tumba la generación
            return Localizacion.solo_pagina()

    def _a_regiones(self, page: pdfium.PdfPage, lineas: list[list[float]]) -> list[Region]:
        """Pasa los renglones de coordenadas de página a 0-1 sobre la página tal como se ve.

        La transformación NO se compone a mano (origen abajo-izquierda, desplazamiento del
        CropBox, matriz de rotación): se le pide a `FPDF_PageToDevice`, del propio motor que
        dibuja la página, con los mismos parámetros del render. Así el recuadro no puede
        descuadrarse respecto a la imagen, porque los dos salen del mismo sitio. Es lo que hace
        que CropBox y rotación dejen de ser un riesgo en vez de dos casos especiales que mantener.
        """
        ancho_pt, alto_pt = page.get_size()  # tamaño YA rotado (el que se ve)
        ancho = max(1, round(ancho_pt * _PRECISION))
        alto = max(1, round(alto_pt * _PRECISION))

        regiones: list[Region] = []
        for izq, abajo, der, arriba in lineas:
            x0, y0 = self._a_dispositivo(page, ancho, alto, izq, arriba)
            x1, y1 = self._a_dispositivo(page, ancho, alto, der, abajo)
            regiones.append(
                Region(
                    x0=max(0.0, min(x0, x1) / ancho),
                    y0=max(0.0, min(y0, y1) / alto),
                    x1=min(1.0, max(x0, x1) / ancho),
                    y1=min(1.0, max(y0, y1) / alto),
                )
            )
        return regiones

    @staticmethod
    def _a_dispositivo(
        page: pdfium.PdfPage, ancho: int, alto: int, x: float, y: float
    ) -> tuple[int, int]:
        dx, dy = ctypes.c_int(), ctypes.c_int()
        pdfium_raw.FPDF_PageToDevice(
            page.raw, 0, 0, ancho, alto, 0, x, y, ctypes.byref(dx), ctypes.byref(dy)
        )
        return dx.value, dy.value
