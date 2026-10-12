"""Límite de intentos para los endpoints de cuenta.

**Solo aquí, y a propósito.** Es el único sitio del sistema donde el secreto lo elige una persona,
así que es el único donde contar intentos sirve de algo: contra un código generado al azar, un
contador no añade nada medible, y contra una contraseña que alguien se tuvo que aprender, sí.

**Dos llaves, y no valen lo mismo.** La del correo protege una cuenta concreta y no se puede
esquivar: quien quiera entrar en esa cuenta tiene que nombrarla. La de la dirección protege contra
el barrido de muchas cuentas a la vez y es *best-effort*, porque detrás de dos proxies la dirección
de quien llama es un dato que hay que deducir (ver `ip_del_cliente`). Que una sea más débil no es
motivo para quitarla: cubren ataques distintos.

**En memoria del proceso, no en la base.** Un intento fallido no merece una escritura en SQLite, y
el registro de fallos no es un dato que haya que conservar. La limitación hay que decirla: se
reinicia con cada despliegue, y con dos instancias cada una contaría por su cuenta. Con una
instancia única —que es como está desplegado esto— es lo correcto.
"""

from __future__ import annotations

import time
from collections import deque

from fastapi import HTTPException, Request

#: Fallos que se toleran dentro de la ventana antes de cerrar la puerta. Cinco deja margen de
#: sobra a quien se equivoca dos veces y sigue siendo un techo bajísimo para adivinar una clave.
MAX_INTENTOS = 5
#: Cuánto se recuerda un fallo, en segundos.
VENTANA_S = 15 * 60
#: Tope de llaves vivas. Sin él, pedir con un correo distinto cada vez hace crecer el diccionario
#: sin final: el límite de intentos no puede convertirse en la forma de tumbar el proceso.
MAX_LLAVES = 10_000


class Intentos:
    """Ventana deslizante de fallos por llave."""

    def __init__(self, maximo: int = MAX_INTENTOS, ventana: int = VENTANA_S) -> None:
        self._maximo = maximo
        self._ventana = ventana
        self._fallos: dict[str, deque[float]] = {}

    def _vigentes(self, llave: str, ahora: float) -> deque[float]:
        """Los fallos de esa llave que todavía cuentan, descartando los que ya caducaron."""
        cola = self._fallos.get(llave)
        if cola is None:
            return deque()
        while cola and ahora - cola[0] > self._ventana:
            cola.popleft()
        if not cola:
            del self._fallos[llave]
        return cola

    def espera(self, llave: str) -> int:
        """Segundos que faltan para poder volver a intentar. `0` si se puede ahora."""
        ahora = time.monotonic()
        cola = self._vigentes(llave, ahora)
        if len(cola) < self._maximo:
            return 0
        # Se abre cuando caduque el fallo más viejo, que es el que sostiene el bloqueo.
        return max(1, int(self._ventana - (ahora - cola[0])) + 1)

    def falla(self, llave: str) -> None:
        ahora = time.monotonic()
        if len(self._fallos) >= MAX_LLAVES:
            self._recorta(ahora)
        cola = self._vigentes(llave, ahora)
        cola.append(ahora)
        self._fallos[llave] = cola

    def acierta(self, llave: str) -> None:
        """Un acierto borra el historial: quien se equivocó y luego entró no arrastra nada."""
        self._fallos.pop(llave, None)

    def _recorta(self, ahora: float) -> None:
        """Tira lo caducado y, si aun así sobran llaves, empieza de cero.

        Vaciar del todo es preferible a quedarse sin memoria, y lo que se pierde son fallos
        recientes de muchas llaves distintas, que es justo la situación en la que ya no se está
        defendiendo una cuenta concreta sino aguantando un barrido.
        """
        self._fallos = {
            llave: cola
            for llave, cola in self._fallos.items()
            if cola and ahora - cola[-1] <= self._ventana
        }
        if len(self._fallos) >= MAX_LLAVES:
            self._fallos.clear()

    def olvida_todo(self) -> None:
        """Solo para los tests: un contador global no puede filtrarse de un test al siguiente."""
        self._fallos.clear()


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
    posibles: con una entrada de más, todas las peticiones comparten llave y cinco fallos de
    cualquiera dejan fuera a todo el mundo; con una de menos, cada quien se inventa su dirección y
    el límite no existe.
    """
    if proxies_confiables > 0:
        entradas = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",")]
        entradas = [p for p in entradas if p]
        if len(entradas) >= proxies_confiables:
            return entradas[-proxies_confiables]
    return request.client.host if request.client else "desconocida"


def exige_cupo(contador: Intentos, llaves: tuple[str, ...]) -> None:
    """Lanza 429 si alguna de las llaves agotó sus intentos.

    El mensaje dice los minutos que faltan en vez de «demasiados intentos» a secas: sin eso, quien
    se equivocó de verdad no sabe si esperar un minuto o volver mañana. Y `Retry-After` va aparte
    para que sea legible también por un cliente que no sea un navegador.
    """
    espera = max((contador.espera(llave) for llave in llaves), default=0)
    if not espera:
        return
    minutos = max(1, round(espera / 60))
    raise HTTPException(
        status_code=429,
        detail=f"Demasiados intentos. Vuelve a probar en {minutos} min.",
        headers={"Retry-After": str(espera)},
    )
