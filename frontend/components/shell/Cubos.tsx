"use client";

import { useEffect, useRef } from "react";

/**
 * Una retícula de cubos que se inclinan hacia donde señalas, y sueltan una onda al pulsar.
 *
 * **Vive solo en la biblioteca vacía.** Donde hay tarjetas no entra: esas ya se encienden por el
 * borde al pasar el ratón, y dos cosas reaccionando al cursor en la misma pantalla compiten justo
 * cuando alguien está eligiendo un documento. Aquí no hay nada con qué competir ( la pantalla está
 * vacía por definición ) y es el momento en que más se agradece que algo se vea trabajado.
 *
 * **Escrito desde cero.** Del componente original solo había el uso, no el código, así que esto
 * sale de la descripción y de una captura: rejilla de 8, inclinación máxima de 45 grados, radio de
 * influencia de 3 celdas, borde punteado y onda al pulsar.
 *
 * **Sin estado de React.** Son 64 transformaciones por fotograma: meterlas en estado sería volver
 * a renderizar la pantalla entera sesenta veces por segundo para mover unas cajas. Se escriben al
 * DOM, como el pulgar del segmentado o la baraja de la portada.
 *
 * **Se para cuando no hay nadie.** Sin puntero encima y sin onda viva, el bucle se cancela: no
 * queda nada corriendo detrás. Con «reducir movimiento» no se inclina ni ondea, se queda la
 * retícula quieta, que sigue siendo un dibujo.
 */
interface CubosProps {
  /** Celdas por lado. */
  lado?: number;
  /** Grados que llega a inclinarse la celda más cercana al puntero. */
  anguloMax?: number;
  /** A cuántas celdas de distancia deja de notarse. */
  radio?: number;
  className?: string;
}

type Celda = { el: HTMLDivElement; cx: number; cy: number; rx: number; ry: number };

export function Cubos({ lado = 8, anguloMax = 45, radio = 3, className = "" }: CubosProps) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cont = caja.current;
    if (!cont) return;
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (quieto) return;

    const celdas: Celda[] = Array.from(cont.children).map((n, i) => ({
      el: n as HTMLDivElement,
      cx: (i % lado) + 0.5,
      cy: Math.floor(i / lado) + 0.5,
      rx: 0,
      ry: 0,
    }));

    let raf = 0;
    let puntero: { x: number; y: number } | null = null;
    /** Ondas vivas: desde dónde salieron y cuándo. */
    let ondas: { x: number; y: number; t0: number }[] = [];

    const pintar = (ahora: number) => {
      raf = 0;
      let sigue = false;

      // La onda: un anillo que se aleja del punto pulsado y levanta las celdas a su paso.
      ondas = ondas.filter((o) => ahora - o.t0 < 1400);

      for (const c of celdas) {
        let objX = 0;
        let objY = 0;

        if (puntero) {
          const dx = c.cx - puntero.x;
          const dy = c.cy - puntero.y;
          const d = Math.hypot(dx, dy);
          if (d < radio) {
            const fuerza = 1 - d / radio;
            // Se inclina ALEJÁNDOSE del puntero, que es lo que da la sensación de que el dedo
            // empuja la superficie en vez de atraerla.
            objX = -(dy / (d || 1)) * anguloMax * fuerza;
            objY = (dx / (d || 1)) * anguloMax * fuerza;
            sigue = true;
          }
        }

        for (const o of ondas) {
          const d = Math.hypot(c.cx - o.x, c.cy - o.y);
          const frente = ((ahora - o.t0) / 1400) * (lado * 1.3);
          const cerca = Math.abs(d - frente);
          if (cerca < 1.2) {
            const fuerza = (1 - cerca / 1.2) * (1 - (ahora - o.t0) / 1400);
            objX += anguloMax * 0.9 * fuerza;
            objY += anguloMax * 0.5 * fuerza;
          }
          sigue = true;
        }

        // Persecución suave: sin esto la retícula salta de golpe al mover el ratón.
        c.rx += (objX - c.rx) * 0.16;
        c.ry += (objY - c.ry) * 0.16;
        if (Math.abs(c.rx) > 0.05 || Math.abs(c.ry) > 0.05) sigue = true;
        else {
          c.rx = 0;
          c.ry = 0;
        }
        c.el.style.transform = `rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`;
      }

      if (sigue) raf = requestAnimationFrame(pintar);
    };

    const despertar = () => {
      if (!raf) raf = requestAnimationFrame(pintar);
    };

    /** Dónde cae el puntero, en coordenadas de celda. */
    const enCeldas = (e: PointerEvent) => {
      const r = cont.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * lado, y: ((e.clientY - r.top) / r.height) * lado };
    };

    const mover = (e: PointerEvent) => {
      puntero = enCeldas(e);
      despertar();
    };
    const salir = () => {
      puntero = null;
      despertar();
    };
    const pulsar = (e: PointerEvent) => {
      const p = enCeldas(e);
      ondas.push({ ...p, t0: performance.now() });
      despertar();
    };

    // En la ventana y no en el contenedor: esto vive detrás del contenido y no recibe punteros.
    window.addEventListener("pointermove", mover, { passive: true });
    window.addEventListener("pointerdown", pulsar, { passive: true });
    window.addEventListener("pointerleave", salir);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerdown", pulsar);
      window.removeEventListener("pointerleave", salir);
    };
  }, [lado, anguloMax, radio]);

  return (
    <div
      ref={caja}
      aria-hidden
      className={`pointer-events-none grid [perspective:620px] ${className}`}
      style={{ gridTemplateColumns: `repeat(${lado}, 1fr)` }}
    >
      {Array.from({ length: lado * lado }, (_, i) => (
        <div
          key={i}
          className="aspect-square rounded-[3px] border-[1.5px] border-dashed border-border-strong/45 bg-surface/20 [transform-style:preserve-3d] [will-change:transform]"
        />
      ))}
    </div>
  );
}
