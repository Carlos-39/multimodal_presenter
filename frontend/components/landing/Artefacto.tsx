import { Quotes } from "@phosphor-icons/react";

/**
 * El héroe de la portada: el artefacto que la aplicación produce de verdad.
 *
 * No es una captura ni un dibujo de una interfaz. Es la pieza tipográfica real —una afirmación,
 * su cita al pie, y el pasaje resaltado en el documento del que sale—, compuesta con los mismos
 * tokens y la misma tipografía que usa la aplicación. En este producto el producto es tipográfico:
 * ilustrarlo con una foto sería decorar, y dibujar una ventana falsa con barra de título sería
 * fingir una captura.
 *
 * Las dos piezas están unidas por el resaltador, que es exactamente lo que hace la aplicación: la
 * cita al pie y el pasaje del documento comparten color porque son la misma cosa vista dos veces.
 *
 * El contenido sale del documento de prueba real del proyecto, no es texto de relleno.
 */
export function Artefacto() {
  return (
    <div className="section-enter flex flex-col gap-3">
      {/* Lo que genera */}
      <article className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="font-serif text-base text-foreground">Dónde ocurren</h3>
        <p className="mt-2 font-serif text-[0.9375rem] leading-[1.6] text-foreground-secondary">
          Los duendes rojos se forman muy por encima de las nubes de tormenta, a altitudes a las que
          no llega ningún avión comercial.
        </p>

        <div className="mt-4 flex items-start gap-2 border-t border-border pt-3">
          <Quotes size={13} weight="fill" aria-hidden className="mt-1 shrink-0 text-muted" />
          <p className="font-serif text-xs italic leading-5 text-foreground-secondary">
            <mark className="bg-highlight text-foreground">
              Los duendes rojos ocurren muy por encima de las tormentas eléctricas intensas.
            </mark>{" "}
            <span className="not-italic text-accent">ver en el documento</span>
          </p>
        </div>
      </article>

      {/* De dónde sale */}
      <div className="rounded-xl border border-dashed border-border px-5 py-4">
        <p className="text-[0.6875rem] uppercase tracking-wide text-muted">El documento</p>
        <p className="mt-2 font-serif text-xs leading-[1.7] text-muted">
          …fenómenos luminosos transitorios que la aviación reportó durante décadas sin
          explicación.{" "}
          <mark className="bg-highlight text-foreground">
            Los duendes rojos ocurren muy por encima de las tormentas eléctricas intensas.
          </mark>{" "}
          Su color procede del nitrógeno excitado, y duran apenas unos milisegundos…
        </p>
      </div>
    </div>
  );
}
