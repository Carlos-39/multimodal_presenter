"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Un interruptor de verdad: algo que está puesto o quitado.
 *
 * **Por qué no un botón más.** El chat no es una acción que ocurre y se acaba, es un estado que se
 * queda: o está abierto o no lo está. Un rectángulo que cambia de color obliga a recordar cuál de
 * los dos colores significaba «abierto»; un interruptor lo enseña por la posición, que no hay que
 * aprenderla. Por eso lleva `role="switch"` y no `aria-pressed`: la forma y la semántica dicen lo
 * mismo.
 *
 * **La perilla se estira hacia donde va y se recoge al llegar**, exactamente como el pulgar del
 * control segmentado. No es un efecto nuevo: es el MISMO, y que la aplicación tenga una sola idea
 * de movimiento repetida en dos sitios vale más que tener dos ideas bonitas sin relación.
 *
 * La posición se escribe en el DOM, no en estado de React: es puro dibujo, y meterlo en estado
 * forzaría un render por cada paso del estirón.
 */
interface InterruptorProps {
  checked: boolean;
  onChange: () => void;
  /** Se ve y además es el nombre accesible. */
  label: string;
  disabled?: boolean;
}

/** Medidas de la pista, en píxeles. Son fijas, así que no hay nada que medir en vivo. */
const ANCHO = 36;
const ALTO = 20;
const BORDE = 3;
const PERILLA = ALTO - BORDE * 2;
/** Lo que tarda el borde de atrás en alcanzar al de delante. El mismo que el segmentado. */
const ESTIRON_MS = 150;

export function Interruptor({ checked, onChange, label, disabled = false }: InterruptorProps) {
  const perilla = useRef<HTMLSpanElement>(null);
  const recoger = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * Cómo estaba la última vez. `null` es «todavía no se ha colocado nunca».
   *
   * Lo que decide si hay recorrido es que el valor haya CAMBIADO, no que sea la primera vez. Con
   * una bandera de «ya se estrenó» el modo estricto rompía el interruptor: React monta, limpia y
   * vuelve a montar, así que la segunda pasada se creía un cambio, estiraba la perilla de extremo
   * a extremo y la dejaba así — en reposo, antes de que nadie tocara nada.
   */
  const anterior = useRef<boolean | null>(null);

  const colocar = useCallback((encendido: boolean, saltar: boolean) => {
    const n = perilla.current;
    if (!n) return;
    clearTimeout(recoger.current);

    const destino = encendido ? ANCHO - BORDE - PERILLA : BORDE;
    const sinRecorrido =
      saltar || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (sinRecorrido) {
      n.style.transitionProperty = "none";
      n.style.left = `${destino}px`;
      n.style.width = `${PERILLA}px`;
      void n.offsetWidth; // reflujo, para que la transición vuelva limpia
      n.style.transitionProperty = "";
      return;
    }

    // El estirón: la perilla abarca los dos extremos y después se recoge sobre el suyo.
    n.style.left = `${BORDE}px`;
    n.style.width = `${ANCHO - BORDE * 2}px`;
    recoger.current = setTimeout(() => {
      n.style.left = `${destino}px`;
      n.style.width = `${PERILLA}px`;
    }, ESTIRON_MS);
  }, []);

  // Antes de pintar: nunca se ve la perilla en el sitio equivocado corrigiéndose.
  useLayoutEffect(() => {
    const cambio = anterior.current !== null && anterior.current !== checked;
    anterior.current = checked;
    colocar(checked, !cambio);
    return () => clearTimeout(recoger.current);
  }, [checked, colocar]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="flex items-center gap-2 rounded-md px-1 py-1 text-xs transition-opacity active:scale-95 disabled:opacity-40"
    >
      <span className={checked ? "font-medium text-accent" : "text-foreground-secondary"}>
        {label}
      </span>
      <span
        aria-hidden
        className={`relative block shrink-0 rounded-full ring-1 transition-colors duration-[260ms] ${
          checked ? "bg-accent ring-accent" : "bg-surface-sunken ring-border"
        }`}
        style={{ width: ANCHO, height: ALTO }}
      >
        <span
          ref={perilla}
          className={`absolute rounded-full transition-[left,width] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            checked ? "bg-accent-foreground" : "bg-muted"
          }`}
          style={{ top: BORDE, height: PERILLA }}
        />
      </span>
    </button>
  );
}
