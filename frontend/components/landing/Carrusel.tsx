"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useAvanceSolo } from "@/hooks/useAvanceSolo";
import { useEnPantalla } from "@/hooks/useEnPantalla";
import { CAPACIDADES } from "./capacidades";

/**
 * Las piezas que el sistema sabe hacer, una a una.
 *
 * **Avanza solo, pero se calla en cuanto alguien participa**, con las mismas reglas que el héroe
 * y el párrafo del problema: ver `useAvanceSolo`. Lo que esta pieza gana al compartirlas es la
 * cuarta, que antes no tenía — no empieza a girar hasta estar en pantalla, así que ya no te
 * encuentras una tarjeta a mitad de ciclo al llegar.
 *
 * Las flechas y los puntos son botones de verdad, así que funciona con el teclado.
 */
const INTERVALO_MS = 6000;

export function Carrusel() {
  const { ref, visible } = useEnPantalla<HTMLDivElement>();
  const { indice, ir, pausa } = useAvanceSolo(CAPACIDADES.length, INTERVALO_MS, visible);

  const capacidad = CAPACIDADES[indice];

  return (
    <section className="border-t border-border bg-surface-sunken/40">
      <div ref={ref} className="mx-auto max-w-6xl px-5 py-20" {...pausa}>
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
                <Flecha etiqueta="Anterior" onClick={() => ir(indice - 1)}>
                  <CaretLeft size={14} aria-hidden />
                </Flecha>
                <Flecha etiqueta="Siguiente" onClick={() => ir(indice + 1)}>
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
                      aria-current={i === indice}
                      className={`block h-1.5 rounded-full transition-all ${
                        i === indice ? "w-6 bg-accent" : "w-1.5 bg-border-strong hover:bg-muted"
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
