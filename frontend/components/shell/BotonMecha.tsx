"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, Trash } from "@phosphor-icons/react";

/**
 * Una acción destructiva con ventana para arrepentirse.
 *
 * **La mecha ES el tiempo que queda.** La vuelta que da al borde dura exactamente la ventana, así
 * que mirarla responde «¿cuánto me queda?» sin leer nada. Mismo criterio que el puntico del
 * carrusel.
 *
 * **Nada se destruye hasta que la mecha acaba.** El componente de referencia borra al pulsar y
 * restaura al deshacer; aquí se confirma al final. La diferencia importa: deshacer no tiene que
 * reconstruir nada en el servidor, porque el servidor todavía no se ha enterado.
 *
 * **Quien manda es un temporizador, no la animación.** Es una distinción que parece pedante y no
 * lo es: un evento `finish` de animación solo se despacha si el documento se está pintando, así
 * que con la pestaña en segundo plano —o en cualquier entorno sin render— el borrado no llegaría a
 * ocurrir nunca. La animación dibuja; el reloj decide. Los dos se pausan juntos.
 *
 * **Se detiene si la pestaña se va.** No se puede deshacer lo que no se está viendo. Al volver,
 * sigue donde estaba.
 *
 * Los segundos van también en la etiqueta: con «reducir movimiento» la mecha no recorre nada, y el
 * número es lo que conserva la información.
 */
interface BotonMechaProps {
  /** Qué pasa cuando la mecha llega al final. Aquí es donde se borra de verdad. */
  onConfirmar: () => void;
  onDeshacer?: () => void;
  /** Se avisa al armar y al desarmar, para que el contenedor pueda atenuarse. */
  onArmado?: (armado: boolean) => void;
  etiqueta?: string;
  etiquetaDeshacer?: string;
  ventanaMs?: number;
  /**
   * En reposo solo el icono. La acción principal de una tarjeta es abrirla: «Eliminar» escrito
   * compite en peso con el título y parece lo que hay que hacer. Al armarse sí crece a palabras,
   * porque entonces sí es lo único que importa.
   */
  compacto?: boolean;
  className?: string;
}

export function BotonMecha({
  onConfirmar,
  onDeshacer,
  onArmado,
  etiqueta = "Eliminar",
  etiquetaDeshacer = "Deshacer",
  ventanaMs = 5000,
  compacto = false,
  className = "",
}: BotonMechaProps) {
  const [armado, setArmado] = useState(false);
  const [restante, setRestante] = useState(Math.ceil(ventanaMs / 1000));

  const mecha = useRef<SVGRectElement>(null);
  const dibujo = useRef<Animation | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Cuándo debe confirmarse, en tiempo del reloj. `null` si está pausado. */
  const vence = useRef<number | null>(null);
  /** Lo que falta cuando está pausado. */
  const pendiente = useRef(ventanaMs);

  // Los callbacks en un ref: la mecha se enciende una vez y no debe reiniciarse porque el padre
  // haya vuelto a renderizar con funciones nuevas.
  const ultimos = useRef({ onConfirmar, onDeshacer, onArmado });
  useEffect(() => {
    ultimos.current = { onConfirmar, onDeshacer, onArmado };
  });

  const apagar = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = undefined;
    vence.current = null;
    pendiente.current = ventanaMs;
    dibujo.current?.cancel();
    dibujo.current = null;
  }, [ventanaMs]);

  const programar = useCallback((ms: number) => {
    clearTimeout(temporizador.current);
    vence.current = Date.now() + ms;
    temporizador.current = setTimeout(() => {
      vence.current = null;
      dibujo.current = null;
      setArmado(false);
      ultimos.current.onArmado?.(false);
      ultimos.current.onConfirmar();
    }, ms);
  }, []);

  function armar() {
    const borde = mecha.current;
    if (armado) return;
    // La animación es solo el dibujo: si no hay elemento o el navegador no la soporta, la ventana
    // sigue funcionando igual.
    dibujo.current =
      borde?.animate?.([{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }], {
        duration: ventanaMs,
        easing: "linear",
        fill: "forwards",
      }) ?? null;
    pendiente.current = ventanaMs;
    programar(ventanaMs);
    setRestante(Math.ceil(ventanaMs / 1000));
    setArmado(true);
    ultimos.current.onArmado?.(true);
  }

  function deshacer() {
    if (!armado) return;
    apagar();
    setArmado(false);
    setRestante(Math.ceil(ventanaMs / 1000));
    ultimos.current.onArmado?.(false);
    ultimos.current.onDeshacer?.();
  }

  /** Pausar y reanudar mueven el reloj y el dibujo a la vez, para que no se separen. */
  const pausar = useCallback(() => {
    if (vence.current === null) return;
    pendiente.current = Math.max(0, vence.current - Date.now());
    clearTimeout(temporizador.current);
    vence.current = null;
    dibujo.current?.pause();
  }, []);

  const reanudar = useCallback(() => {
    if (!armado || vence.current !== null) return;
    programar(pendiente.current);
    dibujo.current?.play();
  }, [armado, programar]);

  // Los segundos salen del mismo reloj que decide, no de la animación.
  useEffect(() => {
    if (!armado) return;
    const t = setInterval(() => {
      const ms = vence.current !== null ? vence.current - Date.now() : pendiente.current;
      setRestante(Math.max(0, Math.ceil(ms / 1000)));
    }, 200);
    return () => clearInterval(t);
  }, [armado]);

  useEffect(() => {
    if (!armado) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") deshacer();
    };
    const visibilidad = () => (document.hidden ? pausar() : reanudar());
    document.addEventListener("keydown", tecla);
    document.addEventListener("visibilitychange", visibilidad);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("visibilitychange", visibilidad);
    };
  });

  useEffect(() => apagar, [apagar]);

  return (
    <button
      type="button"
      onClick={armado ? deshacer : armar}
      // El ratón encima pausa: estás leyendo o dudando, no corre prisa.
      onPointerEnter={pausar}
      onPointerLeave={reanudar}
      aria-keyshortcuts={armado ? "Escape" : undefined}
      aria-label={compacto && !armado ? etiqueta : undefined}
      title={compacto && !armado ? etiqueta : undefined}
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-md border py-1 text-xs transition-colors ${
        compacto && !armado ? "px-1.5" : "px-2.5"
      } ${
        armado
          ? "border-warning bg-surface text-warning"
          : "border-transparent text-muted hover:border-border-strong hover:text-foreground"
      } ${className}`}
    >
      {armado ? <ArrowCounterClockwise size={13} aria-hidden /> : <Trash size={13} aria-hidden />}
      {armado ? etiquetaDeshacer : compacto ? null : etiqueta}
      {armado ? <span className="tabular opacity-70">{restante}</span> : null}

      {/* La mecha recorre el borde. `pathLength=1` normaliza el perímetro, así que el recorrido
          dura lo mismo sea cual sea el tamaño del botón. */}
      <svg
        className={`pointer-events-none absolute inset-0 h-full w-full ${armado ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      >
        <rect
          ref={mecha}
          x="0.75"
          y="0.75"
          width="calc(100% - 1.5px)"
          height="calc(100% - 1.5px)"
          rx="5"
          pathLength="1"
          fill="none"
          strokeWidth="1.5"
          strokeDasharray="1"
          className="stroke-warning motion-reduce:hidden"
        />
      </svg>

      <span className="sr-only" role="status">
        {armado ? `Se eliminará en ${restante} segundos. Pulsa para deshacer.` : ""}
      </span>
    </button>
  );
}
