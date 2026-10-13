"""Reglas de forma que comparten los prompts cuyo texto se pinta tal cual.

Existe por un fallo concreto: al pulsar «explicar esta imagen», la explicación salía con los
asteriscos y las almohadillas a la vista —`**así**`— porque el modelo respondía en Markdown y la
interfaz lo pinta como texto plano. Y lo pinta como texto plano a propósito: en este proyecto no
hay ningún renderizador de Markdown, y no lo hay porque admitirlo invitaría a meter en el
contenido cosas que el diseño no sabe componer (encabezados dentro de una tarjeta, tablas que no
pasaron por `content_type`, enlaces que esquivan el anclaje a la fuente).

Así que la regla no es «no uses Markdown porque queda feo»: es que la estructura de una respuesta
se declara en el esquema —`content_type`, `table`, `chart`, `timeline`— y no en la puntuación del
texto. Donde el modelo quiera una tabla, hay un tipo para pedirla.

Queda fuera, y es deliberado: la estructuración del documento, la presentación y el guion de la
narración. Sus salidas ya son estructuradas o muy cortas, y tocar esos prompts cambia lo que
generan — no es algo que convenga hacer en mitad de una evaluación sin medir el antes y el
después.
"""

from __future__ import annotations

SIN_MARKDOWN = (
    "Escribe en prosa corriente, sin Markdown: nada de asteriscos para resaltar, almohadillas "
    "para titular, guiones para enumerar ni acentos graves para marcar código. El texto se "
    "muestra tal cual se recibe, así que esos símbolos se verían escritos."
)
