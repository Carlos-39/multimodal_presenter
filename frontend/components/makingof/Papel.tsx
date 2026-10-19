"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Acto } from "@/lib/makingOf";

/**
 * El papel del «cómo se construyó», con el tono de su acto.
 *
 * **Lo que cambia es el acto, no el capítulo.** Cinco tonos para catorce capítulos: dentro de un
 * acto el papel no se mueve, y cuando se mueve es porque la historia ha cambiado de parte. Un
 * color por página no diría nada; uno por acto dice en qué mitad del relato estás sin que haya
 * que leer nada.
 *
 * **La historia se va aclarando**: empieza en el tono hundido (los cimientos) y acaba en el de las
 * tarjetas. No es un degradado bonito: es que al final del relato las cosas están resueltas.
 *
 * Dos momentos distintos, y a propósito no se solapan:
 *
 * - **Al llegar**, el tono entra despacio (dos segundos) desde el papel neutro. Evita el fogonazo
 *   de un color que cambia de golpe en una pantalla hecha para leer, y deja algo que se asienta
 *   mientras empiezas.
 * - **Al cambiar de acto** ya dentro, el papel se cambia por celdas, de la esquina de arriba a la
 *   izquierda hacia abajo. Es un corte, que es lo que un cambio de acto es.
 *
 * Quien decide cuándo ha terminado el barrido es un reloj y no el evento `finish` de la animación:
 * ese solo se despacha si el documento se está pintando, así que en una pestaña de fondo el papel
 * se quedaría a medias para siempre. Es la misma lección que costó la mecha de eliminar.
 */
const CELDA = 64;
const PASO_MS = 460;
const BARRIDO_MS = 1050;

export function Papel({ acto }: { acto: Acto | null }) {
  const clase = acto ? `acto-${acto}` : "acto-neutro";
  const [puesto, setPuesto] = useState(clase);
  const [entrando, setEntrando] = useState<string | null>(null);
  const [asentado, setAsentado] = useState(false);
  const estrenado = useRef(false);

  const caja = useRef<HTMLDivElement>(null);
  const celdas = useRef<(HTMLDivElement | null)[]>([]);
  const dentro = useRef<(HTMLDivElement | null)[]>([]);
  const [rejilla, setRejilla] = useState<{ x: number; y: number; orden: number }[]>([]);
  const [medida, setMedida] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const n = caja.current;
    if (!n) return;
    const medir = () => setMedida({ w: n.clientWidth, h: n.clientHeight });
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(n);
    return () => ro.disconnect();
  }, []);

  // El asentado del primer tono. En un microtask para no fijar estado en el cuerpo del efecto.
  useEffect(() => {
    const t = setTimeout(() => setAsentado(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (clase === puesto || entrando) return;
    // Dos casos sin barrido, y se deciden ANTES de montar la rejilla para no tener que
    // deshacerla luego:
    //   - la primera colocación, porque no hay de dónde venir y el tono ya entra con su
    //     transición de dos segundos;
    //   - «reducir movimiento», donde el tono cambia y ya está.
    const quieto =
      !estrenado.current || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (quieto) {
      estrenado.current = true;
      setPuesto(clase);
      return;
    }
    const cols = Math.ceil(medida.w / CELDA) || 1;
    const filas = Math.ceil(medida.h / CELDA) || 1;
    const lista = [];
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        lista.push({
          x: c * CELDA,
          y: f * CELDA,
          // En diagonal desde arriba a la izquierda: le da dirección a un cambio que si no
          // parecería ruido.
          orden: (c / Math.max(1, cols - 1) + f / Math.max(1, filas - 1)) / 2,
        });
      }
    }
    setRejilla(lista);
    setEntrando(clase);
  }, [clase, puesto, entrando, medida]);

  useEffect(() => {
    estrenado.current = true;
  }, []);

  const rematar = useCallback(() => {
    setEntrando((e) => {
      if (e) setPuesto(e);
      return null;
    });
    setRejilla([]);
  }, []);

  useLayoutEffect(() => {
    if (!entrando || !rejilla.length) return;
    const vivas: Animation[] = [];
    const reparto = Math.max(0, BARRIDO_MS - PASO_MS);
    rejilla.forEach((celda, k) => {
      const ventana = celdas.current[k];
      const interior = dentro.current[k];
      if (!ventana || !interior) return;
      const timing: KeyframeAnimationOptions = {
        duration: PASO_MS,
        delay: celda.orden * reparto,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      };
      vivas.push(
        ventana.animate(
          [
            { opacity: 0, transform: "scale(0.35)" },
            { opacity: 1, transform: "scale(1.02)" },
          ],
          timing,
        ),
        // La inversa exacta sobre el centro de la celda: sin esto el tono se vería crecer dentro
        // de cada cuadrito en vez de estar ya puesto.
        interior.animate([{ transform: "scale(2.857)" }, { transform: "scale(0.98)" }], timing),
      );
    });
    const t = setTimeout(rematar, BARRIDO_MS + 60);
    return () => {
      clearTimeout(t);
      vivas.forEach((a) => a.cancel());
    };
  }, [entrando, rejilla, rematar]);

  return (
    <div ref={caja} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={`papel absolute inset-0 ${puesto}`} data-asentado={asentado} />
      {entrando
        ? rejilla.map((celda, k) => (
            <div
              key={k}
              ref={(n) => {
                celdas.current[k] = n;
              }}
              className="absolute overflow-hidden opacity-0"
              style={{ left: celda.x, top: celda.y, width: CELDA, height: CELDA }}
            >
              <div
                ref={(n) => {
                  dentro.current[k] = n;
                }}
                className={`papel absolute ${entrando}`}
                data-asentado="true"
                style={{
                  left: -celda.x,
                  top: -celda.y,
                  width: medida.w,
                  height: medida.h,
                  transformOrigin: `${celda.x + CELDA / 2}px ${celda.y + CELDA / 2}px`,
                }}
              />
            </div>
          ))
        : null}
    </div>
  );
}
