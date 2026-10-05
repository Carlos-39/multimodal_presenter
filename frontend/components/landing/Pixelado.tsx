"use client";

import { useEffect, useRef } from "react";

/**
 * Una trama de píxeles que aparece al pasar por encima de la sección y se va al salir.
 *
 * **Solo al señalar.** La primera versión florecía sola al llegar y se quedaba puesta, y estaba
 * mal por dos motivos: en modo claro la trama competía con el texto justo mientras se lee, y una
 * sección que se decora sola convierte en decorado lo que es el argumento del proyecto. Así solo
 * aparece si alguien la señala, y desaparece al irse — que es lo que hacía el componente del que
 * sale esto y yo había cambiado sin necesidad.
 *
 * **El píxel va en la tinta del texto, no en el acento.** En claro son puntos oscuros sobre papel
 * claro; en oscuro, claros sobre papel oscuro. La trama es siempre lo contrario del papel, que es
 * de donde sale el contraste — y de paso no gasta el azul, que ya trabaja en el héroe.
 *
 * **El retardo de cada píxel es su distancia al centro**, así que la trama se abre como una onda.
 * Esa idea es de la referencia y es la buena.
 *
 * Al salir se recoge y, cuando el último llega a cero, el bucle se cancela: no queda nada
 * corriendo detrás. Con «reducir movimiento» aparece y desaparece de una vez, sin onda.
 *
 * En una pantalla táctil no hay «pasar por encima», así que no aparece. Es decoración: lo que la
 * sección tiene que decir está en el texto.
 */
interface PixeladoProps {
  /** Separación de la malla, en px. */
  paso?: number;
  /** Lado máximo del píxel. */
  lado?: number;
}

type Punto = { x: number; y: number; max: number; tam: number; espera: number; paso: number };

export function Pixelado({ paso = 15, lado = 3 }: PixeladoProps) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cont = caja.current;
    const cv = lienzo.current;
    const ctx = cv?.getContext("2d");
    // Los eventos van en la sección, que es el elemento que se señala; esta capa no los recibe
    // porque está detrás y con los punteros desactivados.
    const zona = cont?.parentElement;
    if (!cont || !cv || !ctx || !zona) return;

    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let puntos: Punto[] = [];
    let raf = 0;
    let dpr = 1;
    let tinta = "#14181c";
    let alfa = 0.16;
    let entrando = false;

    const leerTinta = () => {
      const raiz = document.documentElement;
      tinta = getComputedStyle(raiz).getPropertyValue("--foreground").trim() || tinta;
      const tema = raiz.getAttribute("data-theme");
      const oscuro =
        tema === "dark" ||
        (tema === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
      // En oscuro la trama puede pesar más: un punto claro sobre papel casi negro se ve con menos
      // tinta de la que haría falta al revés, donde además compite con el texto.
      alfa = oscuro ? 0.26 : 0.16;
    };

    const sembrar = () => {
      const w = Math.max(1, cont.clientWidth);
      const h = Math.max(1, cont.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const cx = w / 2;
      const cy = h / 2;
      const lejos = Math.hypot(cx, cy);
      puntos = [];
      for (let x = 0; x < w; x += paso) {
        for (let y = 0; y < h; y += paso) {
          // Dentro del hueco de la máscara no se siembra. La máscara es CSS y oculta, pero el
          // lienzo seguía pintando ahí: la mitad de los píxeles del bucle eran trabajo que nadie
          // llegaba a ver nunca. Los radios son los mismos que los del `radial-gradient`.
          const e = Math.hypot((x - cx) / (w * 0.27), (y - cy) / (h * 0.23));
          if (e < 0.42) continue;
          const d = Math.hypot(x - cx, y - cy) / lejos;
          puntos.push({
            x,
            y,
            // Tamaño propio por píxel: con todos iguales se lee como una rejilla, no como trama.
            max: lado * (0.35 + Math.random() * 0.65),
            tam: 0,
            espera: quieto ? 0 : d * 520 + Math.random() * 90,
            paso: 0.08 + Math.random() * 0.1,
          });
        }
      }
    };

    const pintar = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = tinta;
      ctx.globalAlpha = alfa;
      for (const p of puntos) {
        if (p.tam <= 0) continue;
        const centro = (lado - p.tam) / 2;
        ctx.fillRect(p.x + centro, p.y + centro, p.tam, p.tam);
      }
      ctx.globalAlpha = 1;
    };

    const latir = (t0: number) => {
      const marco = (ahora: number) => {
        const transcurrido = ahora - t0;
        let faltan = false;
        for (const p of puntos) {
          if (entrando) {
            if (transcurrido < p.espera) {
              faltan = true;
              continue;
            }
            if (p.tam < p.max) {
              p.tam = Math.min(p.max, p.tam + p.paso);
              faltan = true;
            }
          } else if (p.tam > 0) {
            p.tam = Math.max(0, p.tam - 0.14);
            faltan = true;
          }
        }
        pintar();
        // Cuando el último llega a su sitio, esto se apaga. No queda nada corriendo detrás.
        raf = faltan ? requestAnimationFrame(marco) : 0;
      };
      if (raf) cancelAnimationFrame(raf);
      // El primer fotograma, ya: colgar el dibujo de un rAF significa que donde el navegador no
      // lo dispare no aparecería nunca. Misma lección que la mecha.
      marco(t0);
    };

    const entrar = () => {
      if (entrando) return;
      entrando = true;
      leerTinta();
      if (!puntos.length) sembrar();
      if (quieto) for (const p of puntos) p.tam = p.max;
      latir(performance.now());
    };

    const salir = () => {
      if (!entrando) return;
      entrando = false;
      if (quieto) {
        for (const p of puntos) p.tam = 0;
        pintar();
        return;
      }
      latir(performance.now());
    };

    zona.addEventListener("pointerenter", entrar);
    zona.addEventListener("pointerleave", salir);

    const ro = new ResizeObserver(() => {
      if (!puntos.length) return;
      sembrar();
      if (entrando) for (const p of puntos) p.tam = p.max;
      pintar();
    });
    ro.observe(cont);

    const mo = new MutationObserver(() => {
      leerTinta();
      pintar();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      zona.removeEventListener("pointerenter", entrar);
      zona.removeEventListener("pointerleave", salir);
      ro.disconnect();
      mo.disconnect();
    };
  }, [paso, lado]);

  return (
    /*
     * La máscara vacía el centro: la trama queda alrededor, enmarcando, y detrás del texto no hay
     * nada. Es lo que arregla de raíz lo de la legibilidad en claro, en vez de ir bajando el alfa
     * hasta que no se note.
     *
     * Va aquí, en la CAPA, y no en la sección: una máscara recorta al elemento y a todos sus
     * hijos, así que puesta arriba se comería el texto. Ya me pasó con la rejilla de los fondos y
     * con los anillos del héroe.
     */
    <div
      ref={caja}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 [-webkit-mask-image:radial-gradient(ellipse_54%_46%_at_50%_50%,transparent_42%,black_100%)] [mask-image:radial-gradient(ellipse_54%_46%_at_50%_50%,transparent_42%,black_100%)]"
    >
      <canvas ref={lienzo} className="block h-full w-full" />
    </div>
  );
}
