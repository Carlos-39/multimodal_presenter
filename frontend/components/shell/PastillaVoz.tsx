"use client";

import { useEffect, useRef } from "react";
import { CircleNotch, Microphone, Stop } from "@phosphor-icons/react";
import type { VoiceStatus } from "@/hooks/useVoiceInput";

/**
 * El control de grabar, con onda y cronómetro.
 *
 * **La onda es la única señal de que el micrófono te está oyendo.** Antes había un borde que
 * pulsaba, y un borde pulsa igual con el micrófono silenciado, con el canal equivocado o con la
 * mano encima: parecía que grababa y no se sabía. La onda sale del nivel real de la señal, así que
 * si no se mueve es que no entra nada — y eso es información, no decoración.
 *
 * **Se despliega hacia la izquierda, encima de lo que ya hay.** El botón conserva su hueco de
 * 36 px, así que la caja de texto no se mueve al empezar a grabar. Un control que empuja el layout
 * mientras hablas obliga a recolocar la vista justo cuando no estás mirando.
 *
 * El cronómetro no es un adorno: al transcribir se paga por duración, y saber que llevas dos
 * minutos hablando es la diferencia entre parar y seguir.
 *
 * **Dibuja solo mientras graba**, y con `requestAnimationFrame`: el bucle muere al parar, no se
 * queda consumiendo batería detrás de un panel cerrado.
 */
interface PastillaVozProps {
  estado: VoiceStatus;
  /** Cuánto suena ahora, de 0 a 1. Lo da el hook, que es quien tiene el micrófono. */
  nivel: () => number;
  onToggle: () => void;
  disabled?: boolean;
}

const BARRAS = 34;

export function PastillaVoz({ estado, nivel, onToggle, disabled = false }: PastillaVozProps) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const reloj = useRef<HTMLSpanElement>(null);
  const historia = useRef<number[]>([]);

  const grabando = estado === "recording";

  useEffect(() => {
    if (!grabando) {
      historia.current = [];
      return;
    }
    const desde = performance.now();
    let raf = 0;
    let ultimaBarra = 0;

    const pintar = (ahora: number) => {
      raf = requestAnimationFrame(pintar);

      // Cronómetro: se escribe directo al DOM. Un `setState` cada 100 ms volvería a renderizar el
      // panel del chat entero mientras se graba.
      if (reloj.current) {
        const s = Math.floor((ahora - desde) / 1000);
        const texto = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        if (reloj.current.textContent !== texto) reloj.current.textContent = texto;
      }

      const v = nivel();
      // Una barra nueva cada ~55 ms: a 60 fps serían 60 barras por segundo y la onda correría tan
      // rápido que no se leería nada.
      if (ahora - ultimaBarra > 55) {
        ultimaBarra = ahora;
        historia.current.push(v);
        if (historia.current.length > BARRAS) historia.current.shift();
      }

      const c = lienzo.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const caja = c.getBoundingClientRect();
      const W = Math.max(1, Math.round(caja.width * dpr));
      const H = Math.max(1, Math.round(caja.height * dpr));
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      // El color sale del propio canvas, así que sigue al token y al tema sin pasarle un hex.
      ctx.fillStyle = getComputedStyle(c).color;
      const ancho = 2 * dpr;
      const paso = W / BARRAS;
      historia.current.forEach((n, i) => {
        // Un mínimo visible aunque haya silencio: una onda que desaparece parece que se colgó.
        const alto = Math.max(ancho, (0.12 + 0.88 * n) * H);
        const x = W - (historia.current.length - i) * paso;
        ctx.globalAlpha = 0.35 + 0.65 * n;
        ctx.beginPath();
        ctx.roundRect(x, (H - alto) / 2, ancho, alto, ancho / 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(pintar);
    return () => cancelAnimationFrame(raf);
  }, [grabando, nivel]);

  return (
    <div className="relative shrink-0">
      {/* El panel se despliega a la IZQUIERDA del botón, y solo existe mientras se graba. */}
      <div
        aria-hidden={!grabando}
        // Se despliega hacia la DERECHA, sobre la caja de texto. Hacia la izquierda no hay sitio
        // —el micro es lo más a la izquierda de la fila— y se salía del panel del chat por encima
        // del documento. Y tapar la caja mientras grabas es honesto: en ese momento eso no es una
        // caja de texto.
        //
        // Ninguna utilidad se declara dos veces: con `px-2.5` en la base y `px-0` en la rama,
        // Tailwind no decide por el orden del atributo sino por el del CSS generado, y el panel
        // plegado se quedaba en 22 px en vez de 0.
        className={`pointer-events-none absolute left-full top-1/2 z-10 ml-2 flex -translate-y-1/2 items-center gap-2 overflow-hidden rounded-md border bg-surface py-1.5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          grabando
            ? "w-[8.5rem] border-warning px-2.5 opacity-100"
            : "w-0 border-transparent px-0 opacity-0"
        }`}
      >
        <canvas ref={lienzo} className="h-5 w-full text-warning" />
        <span ref={reloj} className="tabular shrink-0 text-[0.6875rem] text-warning">
          0:00
        </span>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={disabled || estado === "transcribing"}
        aria-label={grabando ? "Detener grabación" : "Grabar pregunta por voz"}
        aria-pressed={grabando}
        title="Preguntar por voz"
        className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors active:scale-95 disabled:opacity-40 ${
          grabando
            ? "border-warning text-warning"
            : "border-border text-muted hover:border-border-strong hover:text-foreground"
        }`}
      >
        {estado === "transcribing" ? (
          <CircleNotch size={16} className="animate-spin" aria-hidden />
        ) : grabando ? (
          <Stop size={14} weight="fill" aria-hidden />
        ) : (
          <Microphone size={16} aria-hidden />
        )}
      </button>
    </div>
  );
}
