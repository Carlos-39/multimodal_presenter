"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Un recorrido que avanza solo, y que se calla en cuanto alguien participa.
 *
 * La portada tiene tres piezas que enseñan algo paso a paso —la demostración del héroe, el
 * párrafo con y sin fuente, y el carrusel de capacidades—, y **la mayoría de quien llega no pulsa
 * nada**. Si no se mueven solas, no enseñan nada. Pero un carrusel que sigue girando mientras
 * intentas leer una tarjeta es exactamente el motivo por el que los carruseles tienen mala fama,
 * así que las tres se rigen por las mismas cuatro reglas:
 *
 * 1. **Se para al pasar el ratón y al enfocar con el teclado**, y sigue al salir.
 * 2. **Se calla para siempre en cuanto alguien pulsa un control.** A partir de ahí manda quien
 *    mira: ya decidió qué quiere ver y nada se lo va a quitar de delante.
 * 3. **No arranca si el sistema pide reducir movimiento.** Queda quieto en el primer paso.
 * 4. **No arranca hasta que la pieza está en pantalla** (`listo`). Si no, el párrafo del problema
 *    se habría volteado solo mientras nadie lo veía, y llegarías a él en un estado cualquiera en
 *    vez de verlo cambiar.
 *
 * Es el mismo criterio que ya cumplía el carrusel a mano. Lo que cambia es que ahora está escrito
 * una vez: tres copias de esta lógica se habrían separado en silencio.
 */
/**
 * Devuelve `i` dentro de `[0, total)`, dando la vuelta por los dos lados.
 *
 * El `% total` de JavaScript conserva el signo, así que `-1 % 6` es `-1` y no `5`. La fórmula
 * anterior del carrusel —`(i + total) % total`— arreglaba un solo paso por debajo de cero, que es
 * lo único que podía pasar con su botón «Anterior». Esta aguanta cualquier salto, que es lo que
 * hace falta ahora que el mismo recorrido lo comparten tres piezas con distinto número de pasos.
 */
export function enRango(i: number, total: number): number {
  return ((i % total) + total) % total;
}

export function useAvanceSolo(total: number, intervaloMs: number, listo = true) {
  const [indice, setIndice] = useState(0);
  const [detenido, setDetenido] = useState(false);
  // Estado y no `ref`: así el efecto reacciona en el acto al primer clic, sin esperar a que el
  // ratón salga. Con un `ref` el intervalo seguía vivo hasta el siguiente cambio de `detenido`.
  const [intervenido, setIntervenido] = useState(false);

  const ir = useCallback(
    (i: number) => {
      setIntervenido(true);
      setIndice(enRango(i, total));
    },
    [total],
  );

  useEffect(() => {
    if (!listo || detenido || intervenido) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndice((i) => (i + 1) % total), intervaloMs);
    return () => clearInterval(t);
  }, [listo, detenido, intervenido, total, intervaloMs]);

  return {
    indice,
    ir,
    /** Se reparten sobre el contenedor de la pieza, no sobre cada control. */
    pausa: {
      onMouseEnter: () => setDetenido(true),
      onMouseLeave: () => setDetenido(false),
      onFocusCapture: () => setDetenido(true),
      onBlurCapture: () => setDetenido(false),
    },
  };
}
