"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Avisa cuando un elemento entra en pantalla, una sola vez.
 *
 * Con `IntersectionObserver` y no escuchando el scroll: un manejador de `scroll` corre en cada
 * fotograma y, si además toca estado de React, vuelve a renderizar el árbol entero mientras se
 * desplaza. El observador avisa una vez y se desconecta.
 *
 * Devuelve `true` de entrada cuando no hay observador (renderizado en servidor, navegador viejo):
 * es preferible mostrar el contenido sin su animación que dejarlo invisible para siempre.
 */
export function useEnPantalla<T extends HTMLElement>(margen = "0px 0px -15% 0px") {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    if (typeof IntersectionObserver === "undefined") {
      // En un microtask y no aquí mismo: la regla de pureza del proyecto prohíbe `setState`
      // síncrono en el cuerpo de un efecto, porque encadena renders. Aquí además hacerlo
      // síncrono daría un render de más en el único caso que nunca se da en un navegador
      // moderno.
      queueMicrotask(() => setVisible(true));
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: margen },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [margen]);

  return { ref, visible };
}
