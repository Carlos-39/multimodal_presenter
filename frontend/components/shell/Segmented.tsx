"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Control segmentado: elegir UNA entre pocas opciones excluyentes. Lo usan los dos selectores de
 * "cómo ver" el contenido (vista y nivel de detalle), para que se lean como la misma familia.
 * `value` puede no coincidir con ninguna opción (nada seleccionado).
 *
 * **El fondo de la opción activa se desliza en vez de saltar**, y al hacerlo se estira: el borde
 * que va delante llega primero y el de atrás lo alcanza. No es adorno, un salto no dice de dónde
 * vienes, y aquí el gesto conecta las dos opciones. Mismo criterio que la lámina del carrusel, que
 * entra por el lado del que vienes.
 *
 * **La posición del pulgar se escribe en el DOM, no en estado de React.** Es un elemento puramente
 * visual: meterlo en estado forzaría un render por cada paso del estirón sin que cambie nada del
 * árbol. Y de paso respeta la regla de pureza del proyecto, que prohíbe `setState` síncrono en un
 * efecto: que es justo donde hay que medir.
 *
 * Sin librería de animación: el estirón son dos escrituras seguidas con una transición CSS encima.
 * `motion` serían 34 kB para lo único que no se puede hacer así, arrastrar el pulgar, y en un
 * control de dos opciones arrastrar no aporta nada.
 *
 * Con «reducir movimiento» el pulgar salta: sigue marcando lo activo, sin recorrido.
 *
 * **Lo activo va en acento, pero el pulgar sigue siendo papel.** Rellenarlo de azul lo convertiría
 * en un botón, y el azul relleno ya significa otra cosa en esta aplicación: la acción principal
 * («Generar presentación», «Nueva»). Esto no se pulsa para que pase algo, se pulsa para mirar otra
 * cosa. Dejar el pulgar claro con el borde y la palabra en acento tiene además una ventaja de
 * contraste: durante el estirón, la caja cubre las DOS opciones, y sobre un relleno azul la opción
 * que se va quedaría medio segundo en gris sobre azul, ilegible justo cuando se la está mirando.
 */
interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  label: string; // nombre accesible del grupo
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** Lo que tarda el borde de atrás en alcanzar al de delante. */
const ESTIRON_MS = 150;

export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const pulgar = useRef<HTMLSpanElement>(null);
  const anterior = useRef<{ left: number; width: number } | null>(null);
  const recoger = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * Hay un estirón a medias. Lo mira el `ResizeObserver` para no pisarlo: al activarse, el botón
   * gana `font-medium` y **cambia de ancho**, lo que dispara el observador, que recolocaba el
   * pulgar al instante y se comía la animación entera.
   */
  const enVuelo = useRef(false);

  const indice = options.findIndex((o) => o.value === value);

  /** Coloca el pulgar. `saltar` lo pone sin recorrido: primera vez y «reducir movimiento». */
  const colocar = useCallback((i: number, saltar: boolean) => {
    const marco = pulgar.current;
    if (!marco) return;
    clearTimeout(recoger.current);
    enVuelo.current = false;

    const el = i >= 0 ? botones.current[i] : null;
    if (!el) {
      anterior.current = null;
      marco.hidden = true;
      return;
    }
    const destino = { left: el.offsetLeft, width: el.offsetWidth };
    const origen = anterior.current;
    anterior.current = destino;
    marco.hidden = false;

    const sinRecorrido =
      saltar || !origen || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (sinRecorrido) {
      // Sin transición en el primer colocado: si no, el pulgar se vería viajar desde la esquina.
      marco.style.transitionProperty = "none";
      marco.style.left = `${destino.left}px`;
      marco.style.width = `${destino.width}px`;
      void marco.offsetWidth; // fuerza el reflujo para que la transición vuelva limpia
      marco.style.transitionProperty = "";
      return;
    }

    // El estirón: la caja abarca origen y destino, y después se recoge sobre el destino.
    const izq = Math.min(origen.left, destino.left);
    const der = Math.max(origen.left + origen.width, destino.left + destino.width);
    marco.style.left = `${izq}px`;
    marco.style.width = `${der - izq}px`;
    enVuelo.current = true;
    recoger.current = setTimeout(() => {
      // Se vuelve a MEDIR en vez de usar lo capturado: para cuando toca recoger, el botón ya es
      // el activo y engordó con `font-medium`. Con la medida vieja el pulgar quedaba corto.
      const final = { left: el.offsetLeft, width: el.offsetWidth };
      anterior.current = final;
      marco.style.left = `${final.left}px`;
      marco.style.width = `${final.width}px`;
      enVuelo.current = false;
    }, ESTIRON_MS);
  }, []);

  // Antes de pintar: así nunca se ve el pulgar en el sitio equivocado corrigiéndose.
  useLayoutEffect(() => {
    colocar(indice, anterior.current === null);
  }, [indice, colocar]);

  // El índice vive también en un ref para que el efecto de abajo NO dependa de él. Si dependiera,
  // su limpieza correría en cada cambio de opción, y esa limpieza cancela el recogido que el
  // efecto de layout acaba de programar, dejando el pulgar estirado para siempre.
  const indiceRef = useRef(indice);
  useEffect(() => {
    indiceRef.current = indice;
  });

  // El ancho de los botones cambia al cargar la fuente o al cambiar el texto: sin esto el pulgar
  // se queda donde estaba la medida vieja.
  useEffect(() => {
    // No se toca nada mientras hay un estirón en marcha: el propio cambio de peso del botón
    // activo dispara este observador, y recolocar ahí mataría la animación.
    const rehacer = () => {
      if (!enVuelo.current) colocar(indiceRef.current, true);
    };
    const observador = new ResizeObserver(rehacer);
    botones.current.forEach((b) => b && observador.observe(b));
    document.fonts?.ready.then(rehacer).catch(() => {});
    return () => {
      observador.disconnect();
      clearTimeout(recoger.current);
    };
  }, [colocar]);

  function teclas(e: React.KeyboardEvent, i: number) {
    const salto =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!salto) return;
    e.preventDefault();
    // Se salta lo deshabilitado en vez de aterrizar en ello y no poder salir.
    for (let n = 1; n <= options.length; n++) {
      const j = ((i + salto * n) % options.length + options.length) % options.length;
      if (!options[j].disabled) {
        onChange(options[j].value);
        botones.current[j]?.focus();
        return;
      }
    }
  }

  return (
    <div
      className="relative flex items-center gap-0.5 rounded-md bg-surface-sunken p-0.5"
      role="radiogroup"
      aria-label={label}
    >
      <span
        ref={pulgar}
        aria-hidden
        hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 rounded bg-surface ring-1 ring-accent transition-[left,width] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      />

      {options.map((opt, i) => {
        const activa = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(n) => {
              botones.current[i] = n;
            }}
            type="button"
            role="radio"
            aria-checked={activa}
            // Tabulación itinerante: el grupo entero es una parada, y dentro se mueve con flechas.
            tabIndex={activa || (indice < 0 && i === 0) ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => teclas(e, i)}
            className={`relative rounded px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
              activa
                ? "font-medium text-accent"
                : "text-muted hover:text-foreground disabled:hover:text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
