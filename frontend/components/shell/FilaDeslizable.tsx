"use client";

import { useCallback, useRef } from "react";
import { Trash } from "@phosphor-icons/react";

/**
 * Arrastrar una tarjeta hacia la izquierda para eliminarla.
 *
 * **Es un atajo con el dedo, no una forma nueva de borrar.** Al soltar pasado el umbral no se
 * destruye nada: se ARMA la misma mecha del botón, con su ventana para arrepentirse. Una pantalla
 * táctil es justo donde más fácil es empezar un gesto sin querer, así que el deshacer importa más
 * aquí que en ningún otro sitio.
 *
 * **Solo con el dedo (y el lápiz).** Con ratón no se activa: ahí está el botón, que es visible,
 * enfocable y no hay que adivinarlo. Un gesto escondido nunca puede ser la única manera de hacer
 * algo, y aquí no lo es.
 *
 * **El scroll vertical sigue siendo del navegador** (`touch-action: pan-y`): él se queda los
 * movimientos de arriba abajo y a nosotros nos manda los de lado. Así no hay que adivinar el eje
 * a mano ni se queda la lista pegada cuando alguien arrastra en diagonal.
 *
 * La posición durante el arrastre se escribe en el DOM. Con estado de React serían sesenta renders
 * por segundo de la lista entera para mover una tarjeta.
 */
interface FilaDeslizableProps {
  /** Se llama al soltar pasado el umbral. Aquí es donde se arma la mecha, no donde se borra. */
  onDeslizar: () => void;
  children: React.ReactNode;
}

/** Cuánto hay que arrastrar para que soltar signifique algo. */
const UMBRAL = 88;
/** Más allá no se sigue: el recorrido ya dijo todo lo que tenía que decir. */
const TOPE = 132;
/** Holgura antes de considerarlo un arrastre, para no robarle el toque a un simple clic. */
const HOLGURA = 6;

export function FilaDeslizable({ onDeslizar, children }: FilaDeslizableProps) {
  const lamina = useRef<HTMLDivElement>(null);
  const trasera = useRef<HTMLDivElement>(null);
  const partida = useRef<number | null>(null);
  const recorrido = useRef(0);
  const arrastrando = useRef(false);

  const soltar = useCallback(() => {
    const n = lamina.current;
    partida.current = null;
    if (!n) return;
    n.style.transitionProperty = "";
    n.style.transform = "";
    if (trasera.current) trasera.current.dataset.listo = "false";
    if (recorrido.current <= -UMBRAL) onDeslizar();
    recorrido.current = 0;
  }, [onDeslizar]);

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      // Si hubo arrastre, el clic que viene detrás no debe abrir la tarjeta.
      onClickCapture={(e) => {
        if (!arrastrando.current) return;
        arrastrando.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        ref={trasera}
        aria-hidden
        data-listo="false"
        className="fila-trasera absolute inset-0 flex items-center justify-end pr-5"
      >
        <Trash size={18} />
      </div>

      <div
        ref={lamina}
        className="relative touch-pan-y transition-transform duration-300 ease-out motion-reduce:transition-none"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          partida.current = e.clientX;
          recorrido.current = 0;
          arrastrando.current = false;
          if (lamina.current) lamina.current.style.transitionProperty = "none";
        }}
        onPointerMove={(e) => {
          if (partida.current === null) return;
          const d = Math.max(-TOPE, Math.min(0, e.clientX - partida.current));
          if (!arrastrando.current) {
            if (d > -HOLGURA) return;
            arrastrando.current = true;
            // A partir de aquí los eventos son nuestros aunque el dedo se salga de la tarjeta.
            // Capturar es una comodidad, no un requisito: si el navegador dice que ese puntero ya
            // no está activo, lanza — y perder el arrastre entero por eso sería absurdo.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* sin captura: el arrastre sigue mientras el dedo no se salga */
            }
          }
          recorrido.current = d;
          if (lamina.current) lamina.current.style.transform = `translateX(${d}px)`;
          if (trasera.current) trasera.current.dataset.listo = d <= -UMBRAL ? "true" : "false";
        }}
        onPointerUp={soltar}
        // Si el sistema se lleva el puntero (una llamada, un gesto del navegador), la tarjeta
        // vuelve a su sitio en vez de quedarse a medio camino para siempre.
        onPointerCancel={soltar}
      >
        {children}
      </div>
    </div>
  );
}
