"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useAvanceSolo } from "@/hooks/useAvanceSolo";
import { useEnPantalla } from "@/hooks/useEnPantalla";
import { CAPACIDADES } from "./capacidades";
import { Baraja } from "./Baraja";

/**
 * Las piezas que el sistema sabe hacer, una a una.
 *
 * **Avanza solo, pero se calla en cuanto alguien participa**, con las mismas reglas que el héroe
 * y el párrafo del problema: ver `useAvanceSolo`. Lo que esta pieza gana al compartirlas es la
 * cuarta, que antes no tenía: no empieza a girar hasta estar en pantalla, así que ya no te
 * encuentras una tarjeta a mitad de ciclo al llegar.
 *
 * **La lámina entra por el lado del que vienes**, y tarda lo mismo la pases tú o la pase el
 * tiempo. Que el clic acelerase la animación lo haría sentir como una interrupción en vez de como
 * el mando. El punto activo cuenta lo que falta para el siguiente: sin eso la lámina cambia de
 * golpe y parece que la página hace cosas por su cuenta.
 *
 * Las flechas y los puntos son botones de verdad, así que funciona con el teclado.
 */
const INTERVALO_MS = 7000;

export function Carrusel() {
  const { ref, visible } = useEnPantalla<HTMLDivElement>();
  const { indice, sentido, ir, detenido, intervenido, pausa } = useAvanceSolo(
    CAPACIDADES.length,
    INTERVALO_MS,
    visible,
  );

  const capacidad = CAPACIDADES[indice];
  const contando = visible && !intervenido;

  return (
    // `overflow-x-clip` y no `hidden`: mientras la lámina entra desde el lado se sale 20 px, y
    // sin esto aparece barra horizontal en la página entera. `clip` no crea contenedor de scroll
    // y no toca el eje vertical, donde recortaría los anillos de foco.
    <section className="overflow-x-clip border-t border-border bg-surface-sunken/40">
      <div ref={ref} className="mx-auto max-w-6xl px-5 py-20" {...pausa}>
        <h2 className="max-w-[22ch] font-sans text-[2rem] font-medium leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[2.6rem]">
          Todo lo que puedes hacer con un documento
        </h2>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-center lg:gap-14">
          <div>
            {/* `key` fuerza el remontaje para que la entrada se repita en cada cambio. */}
            <div key={capacidad.id} className="pasar" data-sentido={sentido}>
              <h3 className="font-sans text-[1.375rem] font-medium tracking-[-0.016em] text-foreground">{capacidad.titulo}</h3>
              <p className="mt-3 max-w-[42ch] text-[0.9375rem] leading-[1.6] text-foreground-secondary">
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
                {CAPACIDADES.map((c, i) => {
                  const puesto = i === indice;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => ir(i)}
                        aria-label={c.titulo}
                        aria-current={puesto}
                        className={`block h-1.5 overflow-hidden rounded-full transition-all ${
                          puesto
                            ? `w-6 ${contando ? "bg-accent/25" : "bg-accent"}`
                            : "w-1.5 bg-border-strong hover:bg-muted"
                        }`}
                      >
                        {puesto && contando ? (
                          // `key` por índice: la cuenta vuelve a empezar en cada lámina.
                          <span
                            key={indice}
                            aria-hidden
                            className="cuenta block h-full w-full rounded-full bg-accent"
                            data-contando="true"
                            data-detenido={detenido}
                            style={{ ["--espera" as string]: `${INTERVALO_MS}ms` }}
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* La baraja en lugar del panel único: así se ve que hay cinco y cuáles son, que es lo
              que unos puntos no pueden decir. El comportamiento no cambia, sigue siendo el mismo
              `useAvanceSolo` con sus flechas, sus puntos y su cuenta. */}
          <Baraja indice={indice} />
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
