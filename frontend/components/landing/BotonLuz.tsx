"use client";

import { useCallback, useRef } from "react";

/**
 * El botón principal de la portada: una superficie que recoge la luz donde la señalas.
 *
 * **Por qué solo aquí.** Dentro de la aplicación mandan la calma y la seriedad, y un botón que
 * reluce al lado de un documento sería ruido. La portada es otro trabajo: es lo primero que ve
 * alguien que todavía no sabe qué es esto, y una superficie que contesta al dedo dice que la cosa
 * está viva antes que cualquier frase que yo escriba.
 *
 * **Contesta, no empieza.** Sin puntero no hay brillo. Es la diferencia entre un efecto y un
 * reclamo: lo que se mueve solo en una página hay que mirarlo aunque no quieras.
 *
 * **Vive en el componente y no en un paquete.** La referencia pinta esto con WebGL: un renderer,
 * un programa y un shader para un degradado que el navegador ya sabe hacer. Además un lienzo no
 * puede leer los tokens, así que el color del botón habría que pasárselo a mano y se desincroniza
 * con el tema a la primera.
 *
 * La caja se mide al entrar, no en cada movimiento: `getBoundingClientRect` dentro de un
 * `pointermove` es una lectura de layout por fotograma.
 */
interface BotonLuzProps {
  onClick: () => void;
  children: React.ReactNode;
  /** El tamaño lo pone quien lo usa: en el cierre es más grande que en la cabecera. */
  className?: string;
}

export function BotonLuz({ onClick, children, className = "" }: BotonLuzProps) {
  const boton = useRef<HTMLButtonElement>(null);
  const caja = useRef<DOMRect | null>(null);

  const entrar = useCallback(() => {
    caja.current = boton.current?.getBoundingClientRect() ?? null;
  }, []);

  const seguir = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const n = boton.current;
    if (!n) return;
    // Si el movimiento llega sin que haya pasado la entrada, se mide aquí. Depender de que el
    // «entrar» ocurra siempre primero deja el brillo muerto cuando no ocurre, y no es raro: el
    // puntero puede aparecer ya dentro del botón después de un scroll o de que algo se mueva.
    const r = (caja.current ??= n.getBoundingClientRect());
    n.style.setProperty("--luz-x", `${e.clientX - r.left}px`);
    n.style.setProperty("--luz-y", `${e.clientY - r.top}px`);
    n.style.setProperty("--luz-o", "1");
  }, []);

  const apagar = useCallback(() => {
    caja.current = null;
    boton.current?.style.setProperty("--luz-o", "0");
  }, []);

  return (
    <button
      ref={boton}
      type="button"
      onClick={onClick}
      onPointerEnter={entrar}
      onPointerMove={seguir}
      onPointerLeave={apagar}
      onPointerCancel={apagar}
      className={`luz rounded-md bg-accent font-medium text-accent-foreground ${className}`}
    >
      {children}
    </button>
  );
}
