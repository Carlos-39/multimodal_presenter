"""Spike F0 — ¿se puede dibujar un recuadro sobre la parte exacta de una página de PDF?

NO ES CÓDIGO DE PRODUCCIÓN. Es la verificación VISUAL previa a construir el localizador: dibuja
los rectángulos calculados sobre un PNG de la página y los deja en disco para mirarlos con los
ojos. Si esto no cuadra, no tiene sentido construir nada encima.

Lo que se quiere comprobar, en concreto:
1. Que las coordenadas del texto se pueden llevar al píxel correcto de la página renderizada.
2. Los dos casos que la investigación marcó como NO verificados: páginas con **CropBox**
   recortado y páginas **rotadas** (`/Rotate`). Son los que romperían el mapeo.
3. Que agrupar por línea funciona también a **dos columnas** (el riesgo propio de pypdfium2,
   que devuelve un rectángulo por carácter en vez de por línea).

Decisión de mapeo: NO se deduce la transformación a mano (origen abajo-izquierda, desplazamiento
por CropBox, matriz de rotación). Se le pregunta a `FPDF_PageToDevice`, la función del PROPIO
motor que renderiza, con los mismos parámetros del render. Así el recuadro no puede descuadrarse
respecto a la imagen: los dos salen de la misma fuente.

Uso (desde backend/):
    uv run --with pypdfium2 python experiments/spike_regiones_pdf.py
"""

from __future__ import annotations

import ctypes
import sys
from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as raw
from PIL import ImageDraw

ESCALA = 2  # render a 2x: suficiente para mirar el encuadre sin archivos enormes
SALIDA = Path(__file__).resolve().parent / "outputs" / "spike_regiones"


@dataclass
class Rect:
    """Rectángulo en coordenadas NORMALIZADAS 0-1, origen arriba-izquierda."""

    x0: float
    y0: float
    x1: float
    y1: float

    def a_pixeles(self, w: int, h: int) -> tuple[float, float, float, float]:
        return (self.x0 * w, self.y0 * h, self.x1 * w, self.y1 * h)


def _a_dispositivo(page, w_px: int, h_px: int, x: float, y: float) -> tuple[int, int]:
    """Lleva un punto en coordenadas de página a píxeles de la imagen renderizada.

    Se usa la función del propio motor con los mismos parámetros del render, en vez de componer
    la transformación a mano. Esto es lo que hace que CropBox y rotación no sean un riesgo: sea
    cual sea el recorte o el giro, el motor responde dónde cae el punto EN LA IMAGEN que dibujó.
    """
    dx, dy = ctypes.c_int(), ctypes.c_int()
    raw.FPDF_PageToDevice(page.raw, 0, 0, w_px, h_px, 0, x, y, ctypes.byref(dx), ctypes.byref(dy))
    return dx.value, dy.value


def rects_de_rango(page, textpage, idx: int, cnt: int, w_px: int, h_px: int) -> list[Rect]:
    """Rectángulos (uno por LÍNEA) del rango de caracteres [idx, idx+cnt).

    pypdfium2 devuelve una caja por CARÁCTER, así que hay que agrupar. La regla no es agrupar por
    altura parecida —eso une la última línea de una columna con la primera de la siguiente, porque
    comparten altura—, sino recorrer los caracteres EN ORDEN DE LECTURA y cortar cuando la pluma
    salta: cambia de renglón, o retrocede en horizontal. Un salto de columna hace las dos cosas a
    la vez, así que queda cortado igual que un salto de línea.
    """
    # Se agrupa en coordenadas de PÁGINA, no de imagen. En la página el texto siempre avanza de
    # izquierda a derecha con la altura constante, pase lo que pase con `/Rotate` (que es solo un
    # atributo de presentación). Agrupar en la imagen fallaba con páginas rotadas: ahí el renglón
    # avanza en vertical, así que cada carácter parecía un renglón nuevo (78 rects en vez de 2).
    cajas: list[tuple[float, float, float, float]] = []
    for i in range(idx, idx + cnt):
        izq, abajo, der, arriba = textpage.get_charbox(i)
        if der <= izq or arriba <= abajo:
            continue  # espacios y caracteres sin geometría
        cajas.append((izq, abajo, der, arriba))

    if not cajas:
        return []

    lineas: list[list[float]] = []
    actual = list(cajas[0])
    for izq, abajo, der, arriba in cajas[1:]:
        alto = max(1.0, actual[3] - actual[1])
        centro_actual = (actual[1] + actual[3]) / 2
        centro_nuevo = (abajo + arriba) / 2
        salta_renglon = abs(centro_nuevo - centro_actual) > alto * 0.6
        # La pluma vuelve a la izquierda: renglón nuevo, o salto de columna (que hace las dos
        # cosas a la vez y por eso queda cortado igual).
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

    # Solo ahora se pasa a la imagen, línea a línea. Un rectángulo de la página sigue siendo un
    # rectángulo en la imagen porque `/Rotate` solo admite múltiplos de 90 grados.
    salida: list[Rect] = []
    for izq, abajo, der, arriba in lineas:
        x0, y0 = _a_dispositivo(page, w_px, h_px, izq, arriba)
        x1, y1 = _a_dispositivo(page, w_px, h_px, der, abajo)
        salida.append(
            Rect(
                min(x0, x1) / w_px,
                min(y0, y1) / h_px,
                max(x0, x1) / w_px,
                max(y0, y1) / h_px,
            )
        )
    return salida


def localizar(page, cita: str, w_px: int, h_px: int) -> tuple[list[Rect], str]:
    """Peldaño 1 de la escalera (búsqueda exacta). El spike solo valida la GEOMETRÍA."""
    tp = page.get_textpage()
    if not cita.strip():
        return (
            [],
            "",
        )  # página sin capa de texto: nada que localizar (degradaría a fidelidad de página)
    buscador = tp.search(cita, match_case=False, match_whole_word=False)
    hallazgo = buscador.get_next()
    if hallazgo is None:
        return [], ""
    idx, cnt = hallazgo
    return rects_de_rango(page, tp, idx, cnt, w_px, h_px), tp.get_text_range(idx, cnt)


def dibujar(page, rects: list[Rect], destino: Path) -> tuple[int, int]:
    bitmap = page.render(scale=ESCALA)
    img = bitmap.to_pil().convert("RGB")
    lienzo = ImageDraw.Draw(img, "RGBA")
    for r in rects:
        caja = r.a_pixeles(img.width, img.height)
        lienzo.rectangle(caja, fill=(255, 214, 0, 70), outline=(255, 90, 0, 255), width=3)
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino)
    return img.width, img.height


def cita_de_prueba(page, palabras: int = 14, saltar: int = 40) -> str:
    """Toma una cita REAL de la página, lo bastante larga para cruzar un salto de línea."""
    texto = page.get_textpage().get_text_range()
    trozos = texto.split()
    if len(trozos) < saltar + palabras:
        saltar = 0
    return " ".join(trozos[saltar : saltar + palabras])


def pdf_rotado(origen: Path, destino: Path, grados: int = 90) -> Path:
    """Fabrica un PDF con páginas rotadas: ninguno del repertorio real las tiene."""
    import pypdf

    lector = pypdf.PdfReader(str(origen))
    escritor = pypdf.PdfWriter()
    for pg in lector.pages:
        pg.rotate(grados)
        escritor.add_page(pg)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with destino.open("wb") as fh:
        escritor.write(fh)
    return destino


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    base = Path(__file__).resolve().parents[1]
    rotado = pdf_rotado(
        base.parent / "docs" / "ejemplos" / "duendes_rojos.pdf",
        SALIDA / "_fabricado_rotado90.pdf",
    )

    casos = [
        ("duendes_rojos", base.parent / "docs" / "ejemplos" / "duendes_rojos.pdf", 2, None),
        ("attention_2col", base / "tests" / "fixtures" / "local" / "1706.03762v7.pdf", 1, None),
        ("attention_tabla", base / "tests" / "fixtures" / "local" / "1706.03762v7.pdf", 7, None),
        (
            "ipcc_es",
            base / "tests" / "fixtures" / "local" / "IPCC_AR6_WG1_SPM_Spanish.pdf",
            5,
            None,
        ),
        (
            "cropbox_recortado",
            base / "experiments" / "data" / "documents" / "doc_estres.pdf",
            9,
            None,
        ),
        (
            "cropbox_recortado2",
            base / "experiments" / "data" / "documents" / "doc_estres.pdf",
            84,
            None,
        ),
        # El caso que de verdad estresa el agrupado por línea: una cita que CRUZA el salto de
        # columna. Si se agrupara por altura parecida, la última línea de la columna izquierda y
        # la primera de la derecha se fundirían en un rectángulo enorme que cruza la página.
        (
            "dos_columnas_salto",
            base / "experiments" / "data" / "documents" / "doc_typico2.pdf",
            5,
            "productos en grandes volúmenes a bajo costo. GLOSARIO",
        ),
        ("rotado_90", rotado, 2, None),
    ]

    print(
        f"{'caso':<20} {'pág':>4} {'rot':>4} {'crop=media':>11} {'rects':>6} {'match':>6}  salida"
    )
    for nombre, ruta, npag, cita_fija in casos:
        if not ruta.exists():
            print(f"{nombre:<20}  (falta {ruta})")
            continue
        doc = pdfium.PdfDocument(str(ruta))
        if npag >= len(doc):
            npag = 0
        page = doc[npag]
        w_pt, h_pt = page.get_size()
        w_px, h_px = int(w_pt * ESCALA), int(h_pt * ESCALA)
        cita = cita_fija or cita_de_prueba(page)
        rects, recuperado = localizar(page, cita, w_px, h_px)
        destino = SALIDA / f"{nombre}_p{npag + 1}.png"
        iw, ih = dibujar(page, rects, destino)
        crop_igual = [round(v, 1) for v in page.get_cropbox()] == [
            round(v, 1) for v in page.get_mediabox()
        ]
        ok = "sí" if recuperado.strip() else "NO"
        print(
            f"{nombre:<20} {npag + 1:>4} {page.get_rotation():>4} {str(crop_igual):>11} "
            f"{len(rects):>6} {ok:>6}  {destino.name}"
        )
        if not recuperado.strip():
            chars = page.get_textpage().count_chars()
            print(f"      sin match · chars en la página: {chars} · cita: {cita[:50]!r}")
        else:
            # Comprobación clave del mapeo: los rects deben caer DENTRO de la imagen.
            fuera = [r for r in rects if r.x0 < -0.01 or r.y0 < -0.01 or r.x1 > 1.01 or r.y1 > 1.01]
            if fuera:
                print(f"      ¡OJO! {len(fuera)} rect(s) fuera de la página — mapeo roto")
            print(f"      imagen {iw}x{ih} · cita: {recuperado.strip()[:60]!r}")

    print(f"\nPNGs en: {SALIDA}")


if __name__ == "__main__":
    main()
