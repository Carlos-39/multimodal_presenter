"""Contadores deslizantes: cuántas veces ha hecho algo una llave en los últimos N segundos.

Hay dos usos y no son el mismo problema, aunque compartan la mecánica:

- **Intentos de entrar.** El secreto lo elige una persona, así que contar sirve. Se cuentan los
  FALLOS y un acierto borra el historial.
- **Lo que cuesta dinero.** Cada presentación son décimas de dólar reales. Aquí se cuentan TODAS
  las llamadas, salgan bien o mal, porque lo que se está limitando es el gasto y no el acierto.

**En memoria del proceso, no en la base.** Un intento fallido no merece una escritura en SQLite y
el registro no es un dato que haya que conservar. La limitación hay que decirla: se reinicia con
cada despliegue y con dos instancias cada una contaría por su cuenta. Con una instancia —que es
como está desplegado esto— es lo correcto.
"""

from __future__ import annotations

import time
from collections import deque

from fastapi import HTTPException, Request

#: Fallos que se toleran al entrar antes de cerrar la puerta, y durante cuánto se recuerdan.
#: Cinco deja margen de sobra a quien se equivoca dos veces y sigue siendo un techo bajísimo para
#: adivinar una clave.
MAX_INTENTOS = 5
VENTANA_INTENTOS_S = 15 * 60

#: La ventana de lo que cuesta dinero. El TOPE no está aquí: viene de los ajustes, porque es lo
#: único de esto que hay que poder subir o bajar sin tocar código.
VENTANA_GASTO_S = 60 * 60

#: Tope de llaves vivas. Sin él, pedir con un correo distinto cada vez hace crecer el diccionario
#: sin final: un límite no puede convertirse en la forma de tumbar el proceso.
MAX_LLAVES = 10_000

#: Todas las ventanas que existen, para poder vaciarlas de golpe entre tests. Un contador que
#: sobrevive de un test al siguiente deja fallos que aparecen lejos de su causa.
_VENTANAS: list[Ventana] = []


class Ventana:
    """Marcas por llave dentro de una ventana de tiempo que se desplaza."""

    def __init__(self, ventana_s: int) -> None:
        self._ventana = ventana_s
        self._marcas: dict[str, deque[float]] = {}
        _VENTANAS.append(self)

    def _vigentes(self, llave: str, ahora: float) -> deque[float]:
        """Las marcas que todavía cuentan, descartando las que ya caducaron."""
        cola = self._marcas.get(llave)
        if cola is None:
            return deque()
        while cola and ahora - cola[0] > self._ventana:
            cola.popleft()
        if not cola:
            del self._marcas[llave]
        return cola

    def espera(self, llave: str, maximo: int) -> int:
        """Segundos que faltan para poder volver a pasar. `0` si se puede ahora."""
        if maximo <= 0:
            return 0
        ahora = time.monotonic()
        cola = self._vigentes(llave, ahora)
        if len(cola) < maximo:
            return 0
        # Se abre cuando caduque la marca más vieja, que es la que sostiene el bloqueo.
        return max(1, int(self._ventana - (ahora - cola[0])) + 1)

    def marca(self, llave: str) -> None:
        ahora = time.monotonic()
        if len(self._marcas) >= MAX_LLAVES:
            self._recorta(ahora)
        cola = self._vigentes(llave, ahora)
        cola.append(ahora)
        self._marcas[llave] = cola

    def olvida(self, llave: str) -> None:
        """Borra el historial de una llave. Es lo que hace un acierto al entrar."""
        self._marcas.pop(llave, None)

    def _recorta(self, ahora: float) -> None:
        """Tira lo caducado y, si aun así sobran llaves, empieza de cero.

        Vaciar del todo es preferible a quedarse sin memoria, y lo que se pierde son marcas de
        muchas llaves distintas, que es justo la situación en la que ya no se está defendiendo
        nada concreto sino aguantando un barrido.
        """
        self._marcas = {
            llave: cola
            for llave, cola in self._marcas.items()
            if cola and ahora - cola[-1] <= self._ventana
        }
        if len(self._marcas) >= MAX_LLAVES:
            self._marcas.clear()

    def olvida_todo(self) -> None:
        self._marcas.clear()


def vacia_las_ventanas() -> None:
    """Solo para los tests: deja todos los contadores como recién arrancados."""
    for v in _VENTANAS:
        v.olvida_todo()


def ip_del_cliente(request: Request, proxies_confiables: int) -> str:
    """De dónde viene la petición, contando cuántos proxies hay delante.

    Detrás del borde de la plataforma y del propio frontend —que reenvía `/api/*`— `request.client`
    es el proxy, no quien llama. La dirección real viaja en `x-forwarded-for`, pero esa cabecera la
    puede poner cualquiera: las entradas de la izquierda son las que el cliente controla y las de la
    derecha las fue añadiendo cada proxy. Con `n` proxies de confianza delante, la entrada n-ésima
    contando desde el final es la que escribió el primero de ellos, o sea la única que no se puede
    inventar desde fuera.

    Por defecto `n` es 0 y la cabecera se ignora entera, que es lo correcto en local y lo prudente
    en cualquier sitio donde no se haya medido la cadena. Cogerla a ciegas tiene los dos fallos
    posibles: con una entrada de más, todas las peticiones comparten llave y el límite de uno deja
    fuera a todo el mundo; con una de menos, cada quien se inventa su dirección y no hay límite.
    """
    if proxies_confiables > 0:
        entradas = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",")]
        entradas = [p for p in entradas if p]
        if len(entradas) >= proxies_confiables:
            return entradas[-proxies_confiables]
    return request.client.host if request.client else "desconocida"


def exige_cupo(espera: int, mensaje: str) -> None:
    """Lanza 429 si no queda cupo. `espera` es lo que devuelve `Ventana.espera`.

    El mensaje dice cuánto falta en vez de «demasiadas peticiones» a secas: sin ese dato, quien se
    topa con el límite no sabe si esperar un minuto o volver mañana. Y `Retry-After` va aparte para
    que sea legible también por un cliente que no sea un navegador.
    """
    if not espera:
        return
    minutos = max(1, round(espera / 60))
    raise HTTPException(
        status_code=429,
        detail=f"{mensaje} Vuelve a probar en {minutos} min.",
        headers={"Retry-After": str(espera)},
    )
