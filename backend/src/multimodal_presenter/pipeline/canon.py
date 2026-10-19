"""Canonicalización tipográfica compartida por todo el anclaje de citas.

Vive aparte porque la usan dos módulos que no pueden importarse entre sí: `validation` (anclaje
de texto plano) y `pdf_locator` (regiones dentro de una página de PDF). Tenerla en cualquiera de
los dos haría circular la dependencia, y duplicarla sería peor: el mismo modelo citando igual se
trataría distinto según la fuente fuese texto plano o la capa de texto de un PDF.

Las claves se escriben con su código Unicode, no con el carácter. Son signos invisibles o
indistinguibles a simple vista (espacio duro, espacio de ancho cero, guion largo frente a guion
normal): escritos tal cual, nadie puede revisar esta tabla ni detectar si una edición los
convirtió en un espacio corriente: que es exactamente lo que pasó una vez al mover el archivo.
"""

# Un modelo fiel a veces cita con comillas tipográficas, espacios duros o guiones distintos a los
# del documento, y un `find` exacto lo marcaría como no anclado FALSAMENTE. Se canonicaliza la
# puntuación antes de comparar.
#
# El mapa es estrictamente 1 carácter → 1 carácter (misma longitud), y eso no es un detalle: hace
# que un índice hallado sobre el texto canónico siga siendo válido sobre el texto ORIGINAL. Es lo
# que mantiene exacto el resaltado del 5c, y lo que permite al localizador de PDF volver desde una
# posición del texto hasta la caja del carácter que le corresponde.
#
# NO se toca la semántica (no minúsculas, no colapso de espacios): solo se unifican variantes
# tipográficas de un mismo signo.
CANON_MAP = str.maketrans(
    {
        "“": '"',  # comilla doble izquierda
        "”": '"',  # comilla doble derecha
        "‘": "'",  # comilla simple izquierda
        "’": "'",  # comilla simple derecha (y apóstrofo tipográfico)
        " ": " ",  # espacio duro
        " ": " ",  # espacio fino duro
        " ": " ",  # espacio fino
        " ": " ",  # espacio de figura
        "​": " ",  # espacio de ancho cero
        "–": "-",  # guion corto (en dash)
        "—": "-",  # guion largo (em dash)
        "−": "-",  # signo menos
    }
)
