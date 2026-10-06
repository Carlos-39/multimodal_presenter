"use client";

import { useEffect, useRef } from "react";
import { formatTimestamp } from "@/lib/audio";

/**
 * Lo que se enseña mientras algo tarda y no se sabe cuánto.
 *
 * **El reloj es la pieza, no el adorno.** Generar la presentación o la narración son esperas
 * ciegas: el servidor no manda avances, así que hasta ahora lo único que había era un círculo
 * girando — y un círculo girando a los cinco segundos y a los cuarenta y cinco dice exactamente lo
 * mismo. Con el tiempo delante, la espera deja de ser un agujero: sabes si esto va como siempre o
 * si ya pasa algo raro.
 *
 * **La vuelta es indeterminada a propósito.** Una barra que se llena prometería un porcentaje que
 * nadie ha medido. Las otras dos cosas que se mueven solas en la aplicación —el puntico del
 * carrusel y la mecha de eliminar— recorren un tiempo CONOCIDO, y por eso tienen principio y fin;
 * esta no lo tiene porque no lo hay.
 *
 * **Si falla, las mismas celdas se recolocan en una cruz** y el reloj se queda parado en el tiempo
 * que llegó a costar. No hace falta otro icono: es el mismo objeto contando cómo acabó.
 *
 * Es decoración para quien no ve la pantalla (`aria-hidden`): los tres sitios donde se usa ya
 * anuncian el estado con sus propias palabras, y un número que cambia cada segundo dentro de una
 * región viva sería inservible.
 */
interface EsperaProps {
  estado?: "trabajando" | "error";
  className?: string;
}

/**
 * Qué celda se enciende y en qué turno. La rejilla es
 *
 *     0 1 2
 *     3 4 5
 *     6 7 8
 *
 * y el recorrido da la vuelta por el borde en el sentido de las agujas del reloj; el centro
 * (`null`) no participa mientras se trabaja.
 */
const VUELTA = [0, 1, 2, 7, null, 3, 6, 5, 4];
/** Las celdas de la cruz, que son las mismas nueve con el centro ya ocupado. */
const CRUZ = new Set([0, 2, 4, 6, 8]);
/** Lo que tarda el encendido en pasar de una celda a la siguiente. */
const PASO_MS = 110;
const CICLO_MS = 8 * PASO_MS;

export function Espera({ estado = "trabajando", className = "" }: EsperaProps) {
  const reloj = useRef<HTMLSpanElement>(null);
  /** Lo acumulado, para que el cambio a error no reinicie la cuenta ni la pierda. */
  const llevado = useRef(0);

  const fallo = estado === "error";

  useEffect(() => {
    if (fallo) return;
    const desde = performance.now() - llevado.current;
    // Se escribe directo al DOM: un `setState` por segundo volvería a renderizar el panel entero
    // por un número que no decide nada. Mismo criterio que el cronómetro de la pastilla de voz.
    const pintar = () => {
      llevado.current = performance.now() - desde;
      const texto = formatTimestamp(llevado.current / 1000);
      const n = reloj.current;
      if (n && n.textContent !== texto) n.textContent = texto;
    };
    pintar();
    // Cuatro veces por segundo: el segundo cambia a tiempo sin que el salto se note tarde.
    const t = setInterval(pintar, 250);
    return () => clearInterval(t);
  }, [fallo]);

  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 ${className}`} aria-hidden>
      <span className="grid shrink-0 grid-cols-3 gap-[2px]">
        {VUELTA.map((turno, i) => {
          const anima = !fallo && turno !== null;
          return (
            <span
              key={i}
              className={`h-1 w-1 rounded-[1px] bg-current transition-opacity duration-300 ${
                anima ? "espera-celda" : ""
              }`}
              style={
                anima
                  ? ({
                      "--espera-retraso": `${turno * PASO_MS}ms`,
                      "--espera-ciclo": `${CICLO_MS}ms`,
                    } as React.CSSProperties)
                  : { opacity: fallo && CRUZ.has(i) ? 1 : 0 }
              }
            />
          );
        })}
      </span>
      <span ref={reloj} className="tabular text-[0.6875rem] leading-none">
        0:00
      </span>
    </span>
  );
}
