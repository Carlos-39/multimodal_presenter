"use client";

import { useEffect, useRef } from "react";

/**
 * El nombre de la aplicación, enseñando cómo está hecho.
 *
 * **Por qué está donde está.** Va al final, justo encima del enlace a «Cómo se construyó», y ese
 * sitio es la mitad de la idea: un logotipo que destapa sus propias líneas de construcción —el
 * contorno de cada letra, su caja, sus medidas en píxeles— pegado a la invitación a ver cómo se
 * construyó todo lo demás. En cualquier otro punto de la portada sería un efecto bonito; aquí dice
 * algo. Es el mismo criterio con el que el proyecto entero decide qué se queda: que signifique.
 *
 * Una lupa recorre el nombre y, a su paso, las letras cambian de **relleno a contorno punteado**,
 * con su recuadro de selección y sus cotas. Se pueden arrastrar y vuelven con un muelle.
 *
 * **Sin librería ni WebGL**: es un lienzo 2D. Cada letra se dibuja una vez a dos imágenes —maciza
 * y punteada— y luego solo se componen; redibujar texto en cada fotograma sería mucho más caro.
 *
 * Adaptado del TechText de la galería, con tres cambios:
 *
 * - **Los colores salen de los tokens** y se vuelven a leer al cambiar de tema. Un lienzo no sabe
 *   de CSS: sin esto el nombre se quedaría con la tinta del modo contrario.
 * - **La tipografía también**, heredada del contenedor, así que es la Archivo de la aplicación y
 *   no una fuente escrita a mano que se desincronice el día que cambie.
 * - **Fuera el modo de revelado por área**, que es el otro efecto que traía. Usamos el de letra, y
 *   lo que no se usa no se mantiene — mismo criterio que con el postprocesado del shader.
 *
 * Se para cuando no se ve y cuando no hay nada moviéndose: no es un bucle que corra siempre.
 */
interface FirmaProps {
  text?: string;
  className?: string;
}

const FUENTE_COTAS = "10px var(--font-app-mono), ui-monospace, monospace";
const MUELLE = 320;
const AMORTIGUACION = 22;

type Caja = { x1: number; y1: number; x2: number; y2: number };
type Lamina = { image: HTMLCanvasElement; left: number; top: number };
type Trazo = { char: string; x: number; box: Caja };
type Letra = Trazo & {
  offset: { x: number; y: number };
  velocidad: { x: number; y: number };
  contorno: number;
  fill: Lamina;
  punteada: Lamina;
};
type Palabra = {
  size: number;
  baseline: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

const hacia = (actual: number, destino: number, dt: number, segundos: number) =>
  actual + (destino - actual) * (1 - Math.exp(-dt / segundos));

const ruido = (...valores: number[]) => {
  let h = 2166136261;
  for (const v of valores) {
    h = Math.imul(h ^ (v | 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

const conSigno = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");

export function Firma({ text = "Multimodal Presenter", className = "" }: FirmaProps) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const despertar = useRef<() => void>(() => {});

  useEffect(() => {
    const cont = caja.current;
    const cv = lienzo.current;
    const ctx = cv?.getContext("2d");
    const regla = document.createElement("canvas").getContext("2d");
    if (!cont || !cv || !ctx || !regla) return;

    const sinMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let ancho = 1;
    let alto = 1;
    let dpr = 1;
    let raf = 0;
    let ultimo = performance.now();
    let aLaVista = true;
    let viva = true;
    let clave = "";
    let palabra: Palabra | null = null;
    let letras: Letra[] = [];
    let reloj = 0;
    let latido = 0;
    let colocada = false;
    let arrastrando = -1;
    let tinta = "#14181c";
    let acento = "#1e3c84";

    const puntero = { x: 0, y: 0, dentro: false };
    const agarre = { x: 0, y: 0 };
    const lupa = { x: 0, y: 0 };
    const marco = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1 };

    const conAlfa = (hex: string, a: number) => {
      const h = hex.replace("#", "");
      const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
      if (Number.isNaN(n)) return `rgba(255,255,255,${a})`;
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };

    const leerTokens = () => {
      const css = getComputedStyle(document.documentElement);
      tinta = css.getPropertyValue("--foreground").trim() || tinta;
      acento = css.getPropertyValue("--accent").trim() || acento;
      clave = ""; // las láminas llevan el color dentro: hay que redibujarlas
      despertar.current();
    };

    const familia = () => getComputedStyle(cont).fontFamily || "sans-serif";
    const fuente = (tam: number) => `600 ${tam}px ${familia()}`;

    const ponerFuente = (t: CanvasRenderingContext2D, tam: number) => {
      t.font = fuente(tam);
      if ("letterSpacing" in t) t.letterSpacing = `${-0.035 * tam}px`;
      t.textAlign = "left";
      t.textBaseline = "alphabetic";
    };

    /** Cada letra se dibuja UNA vez a su propia imagen; después solo se componen. */
    const lamina = (vista: Palabra, g: Trazo, punteada: boolean): Lamina => {
      const pad = 6;
      const left = g.box.x1 - pad;
      const top = g.box.y1 - pad;
      const w = g.box.x2 - g.box.x1 + pad * 2;
      const h = g.box.y2 - g.box.y1 + pad * 2;
      const image = document.createElement("canvas");
      image.width = Math.max(1, Math.ceil(w * dpr));
      image.height = Math.max(1, Math.ceil(h * dpr));
      const c = image.getContext("2d");
      if (!c) return { image, left, top };
      c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
      ponerFuente(c, vista.size);
      if (punteada) {
        c.lineJoin = "round";
        c.lineWidth = 3;
        c.strokeStyle = tinta;
        c.setLineDash([4, 2]);
        c.strokeText(g.char, g.x, vista.baseline);
        c.setLineDash([]);
        // Se vacía el interior: queda solo el contorno, que es lo que se quiere ver.
        c.globalCompositeOperation = "destination-out";
        c.fillStyle = "#000";
        c.fillText(g.char, g.x, vista.baseline);
        c.globalCompositeOperation = "source-over";
      } else {
        c.fillStyle = tinta;
        c.fillText(g.char, g.x, vista.baseline);
      }
      return { image, left, top };
    };

    const medir = (): Palabra => {
      const k = [text, familia(), ancho, alto, dpr, tinta, acento].join("|");
      if (k === clave && palabra) return palabra;
      clave = k;

      ponerFuente(regla, 100);
      let m = regla.measureText(text);
      const encaje = Math.min(
        1,
        (ancho * 0.92) / Math.max(m.actualBoundingBoxLeft + m.actualBoundingBoxRight, 1),
        (alto * 0.7) / Math.max(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, 1),
      );
      const size = 100 * encaje;
      ponerFuente(regla, size);
      m = regla.measureText(text);
      const anchoTinta = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const altoTinta = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const x = (ancho - anchoTinta) / 2 + m.actualBoundingBoxLeft;
      const baseline = (alto - altoTinta) / 2 + m.actualBoundingBoxAscent;
      const nueva: Palabra = {
        size,
        baseline,
        left: x - m.actualBoundingBoxLeft,
        right: x + m.actualBoundingBoxRight,
        top: baseline - m.actualBoundingBoxAscent,
        bottom: baseline + m.actualBoundingBoxDescent,
      };
      palabra = nueva;

      const previas = letras;
      letras = [];
      let prefijo = "";
      Array.from(text).forEach((char) => {
        prefijo += char;
        const propia = regla.measureText(char);
        const gx = x + regla.measureText(prefijo).width - propia.width;
        if (!char.trim()) return;
        const base: Trazo = {
          char,
          x: gx,
          box: {
            x1: gx - propia.actualBoundingBoxLeft,
            y1: baseline - propia.actualBoundingBoxAscent,
            x2: gx + propia.actualBoundingBoxRight,
            y2: baseline + propia.actualBoundingBoxDescent,
          },
        };
        // Se conserva el desplazamiento si la letra sigue siendo la misma: al cambiar de tema o
        // de tamaño, lo que estabas arrastrando no se teletransporta.
        const antes = previas[letras.length];
        letras.push({
          ...base,
          offset: antes?.char === char ? antes.offset : { x: 0, y: 0 },
          velocidad: { x: 0, y: 0 },
          contorno: 0,
          fill: lamina(nueva, base, false),
          punteada: lamina(nueva, base, true),
        });
      });
      arrastrando = -1;
      marco.index = -1;
      return nueva;
    };

    const letraEn = (x: number, y: number) => {
      if (!palabra || y < palabra.top - 24 || y > palabra.bottom + 24) return -1;
      let mejor = -1;
      let dist = Infinity;
      letras.forEach((g, i) => {
        const x1 = g.box.x1 + g.offset.x;
        const x2 = g.box.x2 + g.offset.x;
        const d = x < x1 ? x1 - x : x > x2 ? x - x2 : 0;
        if (d < dist) {
          dist = d;
          mejor = i;
        }
      });
      return dist < 28 ? mejor : -1;
    };

    const pegar = (g: Lamina, dx: number, dy: number) => {
      ctx.drawImage(g.image, Math.round((g.left + dx) * dpr), Math.round((g.top + dy) * dpr));
    };

    const nitido = (v: number) => (Math.round(v * dpr) + 0.5) / dpr;

    const enElBorde = (d: number, w: number, h: number): [number, number, number, number] => {
      const p = 2 * (w + h);
      let r = ((d % p) + p) % p;
      if (r < w) return [marco.x1 + r, marco.y1, 0, -1];
      r -= w;
      if (r < h) return [marco.x2, marco.y1 + r, 1, 0];
      r -= h;
      if (r < w) return [marco.x2 - r, marco.y2, 0, 1];
      r -= w;
      return [marco.x1, marco.y2 - r, -1, 0];
    };

    /** Los puntitos que recorren el recuadro. Pocos: esto acompaña, no es el espectáculo. */
    const motas = (a: number) => {
      const w = marco.x2 - marco.x1;
      const h = marco.y2 - marco.y1;
      if (w < 2 || h < 2) return;
      const perim = 2 * (w + h);
      const semilla = marco.index + 1;
      for (let k = 0; k < 8; k++) {
        const periodo = 0.5 + ruido(semilla, k, 11) * 1.2;
        const t = latido / periodo + ruido(semilla, k, 17);
        const ciclo = Math.floor(t);
        const vida = t - ciclo;
        if (vida > 0.7) continue;
        const [px, py, nx, ny] = enElBorde(ruido(semilla, k, ciclo) * perim, w, h);
        const tam = ruido(semilla, k, ciclo, 2) < 0.7 ? 2 : 3;
        const fuera = 4 + Math.floor(ruido(semilla, k, ciclo, 1) * 4) * 3;
        ctx.fillStyle = conAlfa(acento, a * (0.3 + 0.5 * ruido(semilla, k, ciclo, 3)));
        ctx.fillRect(Math.round(px + nx * fuera - tam / 2), Math.round(py + ny * fuera - tam / 2), tam, tam);
      }
      for (let i = 0; i < 4; i++) {
        const [x, y] = enElBorde(latido * 0.42 * perim - i * 6, w, h);
        const tam = i === 0 ? 3 : 2;
        ctx.fillStyle = conAlfa(acento, a * [0.95, 0.55, 0.32, 0.16][i]);
        ctx.fillRect(Math.round(x - tam / 2), Math.round(y - tam / 2), tam, tam);
      }
    };

    const dibujarMarco = () => {
      const g = letras[marco.index];
      if (!g || marco.alpha < 0.01) return;
      const a = marco.alpha;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const movida = Math.hypot(g.offset.x, g.offset.y);
      if (movida > 1) {
        // La línea que une dónde ESTABA la letra con dónde está: la cota de un desplazamiento.
        const hx = (g.box.x1 + g.box.x2) / 2;
        const hy = (g.box.y1 + g.box.y2) / 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + g.offset.x, hy + g.offset.y);
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = conAlfa(acento, 0.45 * a);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = conAlfa(acento, 0.7 * a);
        ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 2, 4, 4);
      }

      ctx.beginPath();
      ctx.rect(nitido(marco.x1), nitido(marco.y1), marco.x2 - marco.x1, marco.y2 - marco.y1);
      ctx.lineWidth = 1;
      ctx.strokeStyle = conAlfa(acento, 0.5 * a);
      ctx.stroke();

      ctx.beginPath();
      for (const [cx, cy] of [
        [marco.x1, marco.y1],
        [marco.x2, marco.y1],
        [marco.x2, marco.y2],
        [marco.x1, marco.y2],
      ]) {
        ctx.rect(Math.round(cx) - 2, Math.round(cy) - 2, 5, 5);
      }
      ctx.fillStyle = conAlfa(acento, 0.95 * a);
      ctx.fill();

      ctx.lineWidth = 1;
      motas(a);

      ctx.font = FUENTE_COTAS;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = conAlfa(acento, 0.62 * a);
      ctx.fillText(
        movida > 1
          ? `${conSigno(Math.round(g.offset.x))}, ${conSigno(Math.round(-g.offset.y))}`
          : `${g.char}  ${Math.round(g.box.x2 - g.box.x1)} × ${Math.round(g.box.y2 - g.box.y1)}`,
        Math.round(marco.x1),
        Math.round(marco.y1) - 7,
      );
    };

    const paso = (ahora: number) => {
      raf = 0;
      const dt = Math.min(0.05, Math.max(0.001, (ahora - ultimo) / 1000));
      ultimo = ahora;
      const vista = medir();

      // La lupa pasea sola mientras nadie la lleva; con «reducir movimiento» no pasea.
      const paseando = !sinMovimiento && !puntero.dentro && arrastrando < 0;
      if (paseando) reloj += dt;
      latido += dt;
      let dx = puntero.x;
      let dy = puntero.y;
      if (paseando) {
        dx = vista.left + (vista.right - vista.left) * (0.5 - 0.5 * Math.cos(reloj * 0.45));
        dy = vista.top + (vista.bottom - vista.top) * (0.45 + 0.1 * Math.sin(reloj * 0.8));
      }
      const activa = puntero.dentro || paseando || arrastrando >= 0;
      if (activa && !colocada) {
        lupa.x = dx;
        lupa.y = dy;
      }
      if (activa) {
        const retardo = puntero.dentro ? 0.05 : 0.22;
        lupa.x = hacia(lupa.x, dx, dt, retardo);
        lupa.y = hacia(lupa.y, dy, dt, retardo);
      }
      colocada = activa;

      let moviendo = false;
      letras.forEach((g, i) => {
        if (i === arrastrando) {
          g.offset.x = hacia(g.offset.x, puntero.x - agarre.x, dt, 0.03);
          g.offset.y = hacia(g.offset.y, puntero.y - agarre.y, dt, 0.03);
          g.velocidad.x = 0;
          g.velocidad.y = 0;
          moviendo = true;
          return;
        }
        const { offset, velocidad } = g;
        if (
          Math.abs(offset.x) < 0.05 &&
          Math.abs(offset.y) < 0.05 &&
          Math.hypot(velocidad.x, velocidad.y) < 0.5
        ) {
          offset.x = 0;
          offset.y = 0;
          velocidad.x = 0;
          velocidad.y = 0;
          return;
        }
        velocidad.x += (-MUELLE * offset.x - AMORTIGUACION * velocidad.x) * dt;
        velocidad.y += (-MUELLE * offset.y - AMORTIGUACION * velocidad.y) * dt;
        offset.x += velocidad.x * dt;
        offset.y += velocidad.y * dt;
        moviendo = true;
      });

      const foco = arrastrando >= 0 ? arrastrando : activa ? letraEn(lupa.x, lupa.y) : -1;
      if (foco >= 0) {
        const g = letras[foco];
        const bx1 = g.box.x1 + g.offset.x - 6;
        const by1 = g.box.y1 + g.offset.y - 6;
        const bx2 = g.box.x2 + g.offset.x + 6;
        const by2 = g.box.y2 + g.offset.y + 6;
        if (marco.index < 0 || marco.alpha < 0.02) {
          marco.x1 = bx1;
          marco.y1 = by1;
          marco.x2 = bx2;
          marco.y2 = by2;
        }
        const roce = foco === arrastrando ? 0.02 : 0.08;
        marco.x1 = hacia(marco.x1, bx1, dt, roce);
        marco.y1 = hacia(marco.y1, by1, dt, roce);
        marco.x2 = hacia(marco.x2, bx2, dt, roce);
        marco.y2 = hacia(marco.y2, by2, dt, roce);
        marco.index = foco;
      }
      marco.alpha = hacia(marco.alpha, foco >= 0 ? 1 : 0, dt, 0.1);

      letras.forEach((g, i) => {
        const destino = i === foco && i !== arrastrando ? 1 : 0;
        g.contorno = hacia(g.contorno, destino, dt, 0.09);
        if (Math.abs(g.contorno - destino) > 0.002) moviendo = true;
        else g.contorno = destino;
      });

      cont.style.cursor = arrastrando >= 0 ? "grabbing" : foco >= 0 && puntero.dentro ? "grab" : "";

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, cv.width, cv.height);
      // La huella de dónde estaba la letra, mientras está fuera de su sitio.
      for (const g of letras) {
        const movida = Math.hypot(g.offset.x, g.offset.y);
        if (movida > 1) {
          ctx.globalAlpha = Math.min(1, movida / 24) * 0.55;
          pegar(g.punteada, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
      for (const g of letras) {
        if (g.contorno < 0.999) {
          ctx.globalAlpha = 1 - g.contorno;
          pegar(g.fill, g.offset.x, g.offset.y);
        }
        if (g.contorno > 0.001) {
          ctx.globalAlpha = g.contorno;
          pegar(g.punteada, g.offset.x, g.offset.y);
        }
        ctx.globalAlpha = 1;
      }
      dibujarMarco();

      const asentando = moviendo || (marco.alpha > 0.01 && marco.alpha < 0.99);
      if ((activa || asentando) && aLaVista && viva) raf = requestAnimationFrame(paso);
    };

    const despierta = () => {
      if (raf || !aLaVista || !viva) return;
      ultimo = performance.now();
      raf = requestAnimationFrame(paso);
    };
    despertar.current = despierta;

    const redimensionar = () => {
      ancho = Math.max(1, cont.clientWidth);
      alto = Math.max(1, cont.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(ancho * dpr);
      cv.height = Math.round(alto * dpr);
      clave = "";
      despierta();
    };

    const ubicar = (e: PointerEvent) => {
      const r = cont.getBoundingClientRect();
      puntero.x = e.clientX - r.left;
      puntero.y = e.clientY - r.top;
    };
    const alMover = (e: PointerEvent) => {
      ubicar(e);
      puntero.dentro = true;
      despierta();
    };
    const alSalir = () => {
      if (arrastrando >= 0) return;
      puntero.dentro = false;
      despierta();
    };
    const alBajar = (e: PointerEvent) => {
      ubicar(e);
      puntero.dentro = true;
      if (e.pointerType !== "mouse" || e.button === 0) {
        const i = letraEn(puntero.x, puntero.y);
        if (i >= 0) {
          arrastrando = i;
          agarre.x = puntero.x - letras[i].offset.x;
          agarre.y = puntero.y - letras[i].offset.y;
          cont.setPointerCapture?.(e.pointerId);
        }
      }
      despierta();
    };
    const alSoltar = (e: PointerEvent) => {
      if (arrastrando >= 0) {
        arrastrando = -1;
        cont.releasePointerCapture?.(e.pointerId);
        const r = cont.getBoundingClientRect();
        puntero.dentro =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      }
      despierta();
    };

    cont.addEventListener("pointermove", alMover, { passive: true });
    cont.addEventListener("pointerenter", alMover, { passive: true });
    cont.addEventListener("pointerdown", alBajar, { passive: true });
    cont.addEventListener("pointerup", alSoltar, { passive: true });
    cont.addEventListener("pointercancel", alSoltar, { passive: true });
    cont.addEventListener("pointerleave", alSalir, { passive: true });

    const ro = new ResizeObserver(redimensionar);
    ro.observe(cont);
    const io = new IntersectionObserver(([e]) => {
      aLaVista = e.isIntersecting;
      despierta();
    });
    io.observe(cont);
    const mo = new MutationObserver(leerTokens);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    // Las láminas se dibujan con la fuente que haya en ese momento: si llega después, a repetir.
    document.fonts?.ready.then(
      () => {
        clave = "";
        despierta();
      },
      () => {},
    );

    leerTokens();
    redimensionar();

    return () => {
      viva = false;
      cancelAnimationFrame(raf);
      despertar.current = () => {};
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      cont.removeEventListener("pointermove", alMover);
      cont.removeEventListener("pointerenter", alMover);
      cont.removeEventListener("pointerdown", alBajar);
      cont.removeEventListener("pointerup", alSoltar);
      cont.removeEventListener("pointercancel", alSoltar);
      cont.removeEventListener("pointerleave", alSalir);
    };
  }, [text]);

  return (
    <div
      ref={caja}
      /*
       * `h-full` aquí no es decorativo: el lienzo mide `h-full`, y si este contenedor queda de
       * alto automático se retroalimentan —el lienzo toma su alto del padre, el padre crece con el
       * lienzo— y la caja se dispara. Medido: 556 px donde tenía que haber 128, montándose encima
       * de lo de abajo. El alto lo pone quien lo usa.
       */
      className={`relative h-full w-full touch-pan-y select-none font-sans ${className}`}
      role="img"
      aria-label={text}
    >
      <canvas ref={lienzo} className="block h-full w-full" />
    </div>
  );
}
