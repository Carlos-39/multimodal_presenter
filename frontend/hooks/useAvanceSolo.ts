"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Un recorrido que avanza solo, y que se calla en cuanto alguien participa.
 *
 * La portada tiene tres piezas que enseñan algo paso a paso (la demostración del héroe, el
 * párrafo con y sin fuente, y el carrusel de capacidades), y **la mayoría de quien llega no pulsa
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
 * anterior del carrusel (`(i + total) % total`) arreglaba un solo paso por debajo de cero, que es
 * lo único que podía pasar con su botón «Anterior». Esta aguanta cualquier salto, que es lo que
 * hace falta ahora que el mismo recorrido lo comparten tres piezas con distinto número de pasos.
 */
export function enRango(i: number, total: number): number {
  return ((i % total) + total) % total;
}

export type Sentido = "adelante" | "atras";

export function useAvanceSolo(total: number, intervaloMs: number, listo = true) {
  // El índice y el sentido del último cambio van en UN solo estado, no en dos: separados, un
  // render intermedio podía pintar el índice nuevo con el sentido viejo y la lámina entraba por
  // el lado que no era.
  const [paso, setPaso] = useState<{ i: number; sentido: Sentido }>({ i: 0, sentido: "adelante" });
  const [detenido, setDetenido] = useState(false);
  // Estado y no `ref`: así el efecto reacciona en el acto al primer clic, sin esperar a que el
  // ratón salga. Con un `ref` el intervalo seguía vivo hasta el siguiente cambio de `detenido`.
  const [intervenido, setIntervenido] = useState(false);

  const ir = useCallback(
    (i: number) => {
      setIntervenido(true);
      // El sentido se decide contra el índice SIN normalizar: así `ir(indice - 1)` desde el primer
      // punto se lee como ir hacia atrás, aunque al normalizar acabe en el último.
      setPaso((p) => ({ i: enRango(i, total), sentido: i < p.i ? "atras" : "adelante" }));
    },
    [total],
  );

  useEffect(() => {
    if (!listo || detenido || intervenido) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(
      () => setPaso((p) => ({ i: (p.i + 1) % total, sentido: "adelante" })),
      intervaloMs,
    );
    return () => clearInterval(t);
  }, [listo, detenido, intervenido, total, intervaloMs]);

  return {
    indice: paso.i,
    sentido: paso.sentido,
    ir,
    /** `true` mientras el ratón o el foco están encima: la cuenta se pausa con el recorrido. */
    detenido,
    /** `true` desde el primer clic. Ya no va a pasar nada solo, así que no hay nada que contar. */
    intervenido,
    /** Se reparten sobre el contenedor de la pieza, no sobre cada control. */
    pausa: {
      onMouseEnter: () => setDetenido(true),
      onMouseLeave: () => setDetenido(false),
      onFocusCapture: () => setDetenido(true),
      onBlurCapture: () => setDetenido(false),
    },
  };
}
