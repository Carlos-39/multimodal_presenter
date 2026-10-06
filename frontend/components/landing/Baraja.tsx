"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { CAPACIDADES } from "./capacidades";

/**
 * Las capacidades como una baraja en perspectiva: la de delante abierta, las demás detrás,
 * asomando el nombre.
 *
 * **Lo que gana respecto al panel único** no es el efecto, es que se VE que hay cinco y cuáles
 * son. Antes había una lámina y unos puntos; un punto no dice qué hay dentro, y una pila de
 * tarjetas con su título asomando sí.
 *
 * **Lo que NO cambia** es el comportamiento, que estaba ganado y no se regala: sigue avanzando
 * sola, callándose en cuanto alguien participa, con sus flechas y sus puntos de verdad, su cuenta
 * atrás y su pausa al pasar el ratón. Esto es la presentación.
 *
 * **Sin GSAP.** La referencia usa 70 kB de librería para mover cinco cajas; esto son transiciones
 * CSS escritas al DOM. El `elastic.out` del ejemplo se cambia por un rebote corto: una goma
 * elástica de dos segundos en una página que se lee no es sobriedad, es un juguete.
 *
 * **La posición se escribe en el DOM**, no en estado de React: son cinco transformaciones por
 * paso y meterlas en estado volvería a renderizar la sección entera por algo que no cambia ni un
 * dato. Mismo criterio que el pulgar del segmentado.
 *
 * Es decoración para quien no ve la pantalla (`aria-hidden`): el título y la descripción de la
 * capacidad ya están, en texto, en la columna de al lado.
 */
const SEP_X = 44;
const SEP_Y = 40;
const SESGO = 4;
const CAIDA_MS = 520;
const PASO_MS = 620;

/** Dónde va la tarjeta que está a `k` puestos de la de delante. */
function puesto(k: number) {
  return {
    x: k * SEP_X,
    y: -k * SEP_Y,
    z: -k * SEP_X * 1.6,
    zIndex: CAPACIDADES.length - k,
    opacidad: k === 0 ? 1 : Math.max(0.35, 1 - k * 0.18),
  };
}

function transformar(p: ReturnType<typeof puesto>) {
  return `translate3d(${p.x}px, ${p.y}px, ${p.z}px) skewY(${SESGO}deg)`;
}

export function Baraja({ indice }: { indice: number }) {
  const total = CAPACIDADES.length;
  const tarjetas = useRef<(HTMLDivElement | null)[]>([]);
  const anterior = useRef<number | null>(null);
  const pendiente = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const colocar = useCallback(
    (i: number, k: number, saltar: boolean) => {
      const n = tarjetas.current[i];
      if (!n) return;
      const p = puesto(k);
      if (saltar) n.style.transitionProperty = "none";
      n.style.transform = transformar(p);
      n.style.opacity = String(p.opacidad);
      n.style.zIndex = String(p.zIndex);
      if (saltar) {
        void n.offsetWidth; // reflujo, para que la transición vuelva limpia
        n.style.transitionProperty = "";
      }
    },
    [],
  );

  useLayoutEffect(() => {
    clearTimeout(pendiente.current);
    const antes = anterior.current;
    anterior.current = indice;
    const sinRecorrido =
      antes === null || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const puestoDe = (i: number) => (i - indice + total) % total;

    if (sinRecorrido) {
      CAPACIDADES.forEach((_, i) => colocar(i, puestoDe(i), true));
      return;
    }

    // Solo el avance de uno en uno se cuenta como «la de delante cae». Un salto desde los puntos
    // no tiene una tarjeta que caiga: ahí todas se recolocan y ya.
    const avanzaUna = (indice - antes + total) % total === 1;
    if (!avanzaUna) {
      CAPACIDADES.forEach((_, i) => colocar(i, puestoDe(i), false));
      return;
    }

    const quecae = antes;
    CAPACIDADES.forEach((_, i) => {
      if (i === quecae) return;
      colocar(i, puestoDe(i), false);
    });

    // La que estaba delante se va hacia abajo y se apaga; cuando ya no se ve, se pone al final de
    // la pila sin recorrido y vuelve a encenderse. Sin ese salto en seco, cruzaría la sección
    // entera por delante de las demás.
    const n = tarjetas.current[quecae];
    if (n) {
      n.style.zIndex = String(total + 1);
      n.style.transform = `translate3d(0px, 420px, 0px) skewY(${SESGO}deg)`;
      n.style.opacity = "0";
      pendiente.current = setTimeout(() => colocar(quecae, total - 1, true), CAIDA_MS);
    }

    return () => clearTimeout(pendiente.current);
  }, [indice, total, colocar]);

  useEffect(() => () => clearTimeout(pendiente.current), []);

  return (
    <div
      aria-hidden
      className="relative h-[17rem] [perspective:1100px] sm:h-[21rem]"
      style={{ transformStyle: "preserve-3d" }}
    >
      {CAPACIDADES.map((c, i) => (
        <div
          key={c.id}
          ref={(n) => {
            tarjetas.current[i] = n;
          }}
          className="absolute left-0 top-1/2 w-[min(100%,26rem)] -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-float transition-[transform,opacity] duration-[var(--baraja-paso)] ease-[cubic-bezier(0.34,1.12,0.64,1)] [backface-visibility:hidden] [transform-style:preserve-3d] motion-reduce:transition-none"
          style={{ ["--baraja-paso" as string]: `${PASO_MS}ms` }}
        >
          {/* La cabecera es lo que asoma de las de atrás: por eso el título va aquí y no dentro.
              Es lo que convierte la pila en un índice de lo que hay. */}
          <p className="truncate border-b border-border px-4 py-2.5 text-[0.8125rem] font-medium text-foreground">
            {c.titulo}
          </p>
          <div className="flex min-h-[12rem] items-center justify-center p-6 sm:min-h-[15rem]">
            <c.Lamina />
          </div>
        </div>
      ))}
    </div>
  );
}
