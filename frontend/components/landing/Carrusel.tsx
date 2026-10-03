"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { CAPACIDADES } from "./capacidades";

/**
 * Las piezas que el sistema sabe hacer, una a una.
 *
 * **Avanza solo, pero se calla en cuanto alguien participa.** Se detiene al pasar el ratón, al
 * enfocar con el teclado y en cuanto se pulsa un control: a partir de ahí manda quien mira. Y no
 * arranca si el sistema pide reducir movimiento. Un carrusel que sigue girando mientras intentas
 * leer una tarjeta es el motivo por el que los carruseles tienen mala fama.
 *
 * Las flechas y los puntos son botones de verdad, así que funciona con el teclado.
 */
const INTERVALO_MS = 6000;

export function Carrusel() {
  const [actual, setActual] = useState(0);
  const [detenido, setDetenido] = useState(false);
  // Una vez que alguien toca un control, no se vuelve a mover solo: ya decidió qué quiere ver.
  const intervenido = useRef(false);

  const ir = useCallback((indice: number) => {
    intervenido.current = true;
    setActual((indice + CAPACIDADES.length) % CAPACIDADES.length);
  }, []);

  useEffect(() => {
    if (detenido || intervenido.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActual((i) => (i + 1) % CAPACIDADES.length), INTERVALO_MS);
    return () => clearInterval(t);
  }, [detenido]);

  const capacidad = CAPACIDADES[actual];

  return (
    <section className="border-t border-border bg-surface-sunken/40">
      <div
        className="mx-auto max-w-6xl px-5 py-20"
        onMouseEnter={() => setDetenido(true)}
        onMouseLeave={() => setDetenido(false)}
        onFocusCapture={() => setDetenido(true)}
        onBlurCapture={() => setDetenido(false)}
      >
        <h2 className="max-w-[22ch] font-serif text-[1.75rem] leading-tight text-foreground sm:text-[2.25rem]">
          Todo lo que puedes hacer con un documento
        </h2>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-center lg:gap-14">
          <div>
            {/* `key` fuerza el remontaje para que la entrada se repita en cada cambio. Es el
                mismo lenguaje de aparición que usa la aplicación al llegar una sección. */}
            <div key={capacidad.id} className="section-enter">
              <h3 className="font-serif text-xl text-foreground">{capacidad.titulo}</h3>
              <p className="mt-3 max-w-[42ch] text-sm leading-6 text-foreground-secondary">
                {capacidad.descripcion}
              </p>
            </div>

            <div className="mt-7 flex items-center gap-4">
              <div className="flex gap-1">
                <Flecha etiqueta="Anterior" onClick={() => ir(actual - 1)}>
                  <CaretLeft size={14} aria-hidden />
                </Flecha>
                <Flecha etiqueta="Siguiente" onClick={() => ir(actual + 1)}>
                  <CaretRight size={14} aria-hidden />
                </Flecha>
              </div>

              <ul className="flex items-center gap-1.5">
                {CAPACIDADES.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => ir(i)}
                      aria-label={c.titulo}
                      aria-current={i === actual}
                      className={`block h-1.5 rounded-full transition-all ${
                        i === actual ? "w-6 bg-accent" : "w-1.5 bg-border-strong hover:bg-muted"
                      }`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            key={capacidad.id}
            className="section-enter flex min-h-[15rem] items-center justify-center rounded-xl border border-border bg-surface p-7 lg:min-h-[19rem]"
          >
            <capacidad.Lamina />
          </div>
        </div>
      </div>
    </section>
  );
}

function Flecha({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-border-strong hover:text-foreground"
    >
      {children}
    </button>
  );
}
