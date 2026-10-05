"use client";

import { useEffect, useRef } from "react";

/**
 * Píxeles que florecen cuando llegas a la sección, y se quedan quietos.
 *
 * **Aparece al llegar y se para.** El componente de referencia los enciende al pasar el ratón y
 * los deja titilando para siempre; aquí es una sola floración, de dentro hacia fuera, y cuando el
 * último píxel llega a su tamaño el bucle se cancela solo. Esta es la sección donde se lee el
 * argumento del proyecto: algo parpadeando detrás del texto mientras lo lees no es contraste, es
 * competencia.
 *
 * **El retardo de cada píxel es su distancia al foco**, que es lo que hace que la trama se abra
 * como una onda en vez de aparecer de golpe. Esa idea sí es de la referencia y es la buena.
 *
 * **El grano es distinto al del héroe a propósito.** Los dos son cuadraditos azules, y si tuvieran
 * el mismo tamaño la página parecería tener un solo papel pintado repetido. Aquí la malla es más
 * suelta y el píxel más grande.
 *
 * El color sale del token y se vuelve a leer al cambiar de tema: un lienzo no sabe de CSS.
 *
 * Con «reducir movimiento» no hay floración — se pinta ya puesto, de una vez.
 */
interface PixeladoProps {
  /** Separación de la malla, en px. */
  paso?: number;
  /** Lado máximo del píxel. */
  lado?: number;
  opacidad?: number;
  /** Dónde está el foco del que sale la onda, en fracción de la caja. */
  foco?: { x: number; y: number };
}

type Punto = { x: number; y: number; max: number; tam: number; espera: number; paso: number };

export function Pixelado({
  paso = 14,
  lado = 3,
  opacidad = 0.5,
  foco = { x: 0.22, y: 0.5 },
}: PixeladoProps) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cont = caja.current;
    const cv = lienzo.current;
    const ctx = cv?.getContext("2d");
    if (!cont || !cv || !ctx) return;

    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let puntos: Punto[] = [];
    let raf = 0;
    let dpr = 1;
    let tinta = "#1e3c84";
    let abierto = false;

    const leerTinta = () => {
      tinta = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || tinta;
    };

    const sembrar = () => {
      const w = Math.max(1, cont.clientWidth);
      const h = Math.max(1, cont.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const fx = w * foco.x;
      const fy = h * foco.y;
      const lejos = Math.hypot(Math.max(fx, w - fx), Math.max(fy, h - fy));
      puntos = [];
      for (let x = 0; x < w; x += paso) {
        for (let y = 0; y < h; y += paso) {
          const d = Math.hypot(x - fx, y - fy) / lejos;
          puntos.push({
            x,
            y,
            // Tamaño propio por píxel: una malla con todos iguales se lee como una rejilla.
            max: lado * (0.35 + Math.random() * 0.65),
            tam: 0,
            espera: quieto ? 0 : d * 900 + Math.random() * 120,
            paso: 0.055 + Math.random() * 0.07,
          });
        }
      }
    };

    const pintar = (t0: number) => (ahora: number) => {
      const transcurrido = ahora - t0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = tinta;
      ctx.globalAlpha = opacidad;
      let faltan = false;
      for (const p of puntos) {
        if (transcurrido < p.espera) {
          faltan = true;
          continue;
        }
        if (p.tam < p.max) {
          p.tam = Math.min(p.max, p.tam + p.paso);
          faltan = true;
        }
        const centro = (lado - p.tam) / 2;
        ctx.fillRect(p.x + centro, p.y + centro, p.tam, p.tam);
      }
      ctx.globalAlpha = 1;
      // Cuando el último llega a su tamaño, esto se apaga. No queda nada corriendo detrás.
      if (faltan) raf = requestAnimationFrame(pintar(t0));
      else raf = 0;
    };

    const abrir = () => {
      if (abierto) return;
      abierto = true;
      leerTinta();
      sembrar();
      if (quieto) {
        for (const p of puntos) p.tam = p.max;
      }
      if (raf) cancelAnimationFrame(raf);
      const t0 = performance.now();
      // El primer fotograma se pinta YA, no en el siguiente `requestAnimationFrame`. Con «reducir
      // movimiento» los píxeles salen a su tamaño final de una vez, y colgar ese único dibujo de
      // un `rAF` significa que donde el navegador no lo dispare -una pestaña de fondo, un entorno
      // sin pintar- la trama no aparecería nunca. Misma lección que la mecha: el dibujo no puede
      // depender de que haya dibujo.
      pintar(t0)(t0);
    };

    // Un poco dentro (25 %) y no al rozar el borde: si no, florece mientras todavía se está
    // leyendo la sección de arriba y nadie lo ve.
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) abrir();
      },
      { threshold: 0.25 },
    );
    io.observe(cont);

    const ro = new ResizeObserver(() => {
      if (!abierto) return;
      leerTinta();
      sembrar();
      for (const p of puntos) p.tam = p.max; // ya estaba abierto: se recoloca sin volver a florecer
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pintar(performance.now() - 99999));
    });
    ro.observe(cont);

    const mo = new MutationObserver(() => {
      if (!abierto) return;
      leerTinta();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(pintar(performance.now() - 99999));
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
    };
  }, [paso, lado, opacidad, foco]);

  return (
    <div ref={caja} aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <canvas ref={lienzo} className="block h-full w-full" />
    </div>
  );
}
