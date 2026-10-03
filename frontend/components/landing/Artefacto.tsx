import { Quotes } from "@phosphor-icons/react/dist/ssr";

/**
 * El héroe: el artefacto que la aplicación produce, apareciendo en el orden en que se produce.
 *
 * No es una captura ni una ventana dibujada con barras de título. Es la pieza tipográfica real,
 * con los mismos tokens y la misma tipografía, y **la secuencia es el argumento**: primero está el
 * documento, luego el resaltador recorre la frase, y solo entonces aparece la sección con su
 * cita. En ese orden se ve de dónde sale cada cosa, que es justo lo que el producto promete.
 *
 * Una sola secuencia al cargar, de unos dos segundos. No se repite: el movimiento que insiste
 * deja de informar y empieza a molestar. Con «reducir movimiento» todo aparece ya terminado.
 *
 * El contenido sale del documento de prueba real del proyecto, no es relleno.
 */
const FRASE = "Los duendes rojos ocurren muy por encima de las tormentas eléctricas intensas.";

export function Artefacto() {
  return (
    <div className="flex flex-col gap-3">
      {/* 1 · El documento, tal cual */}
      <div
        className="surgir rounded-xl border border-dashed border-border px-5 py-4"
        style={{ animationDelay: "0.15s" }}
      >
        <p className="text-[0.6875rem] text-muted">Tu documento</p>
        <p className="mt-2 font-serif text-xs leading-[1.75] text-muted">
          …fenómenos luminosos transitorios que la aviación reportó durante décadas sin explicación.{" "}
          {/* 2 · El resaltador recorre la frase: es el gesto del panel de fuente, en vivo */}
          <span className="barrido text-foreground" style={{ animationDelay: "0.9s" }}>
            {FRASE}
          </span>{" "}
          Su color procede del nitrógeno excitado, y duran apenas unos milisegundos…
        </p>
      </div>

      {/* 3 · Lo que la aplicación escribe, con su cita de vuelta */}
      <article
        className="surgir rounded-xl border border-border bg-surface p-5 shadow-sm"
        style={{ animationDelay: "1.65s" }}
      >
        <h2 className="font-serif text-base text-foreground">Dónde ocurren</h2>
        <p className="mt-2 font-serif text-[0.9375rem] leading-[1.6] text-foreground-secondary">
          Los duendes rojos se forman muy por encima de las nubes de tormenta, a altitudes a las
          que no llega ningún avión comercial.
        </p>
        <div className="mt-4 flex items-start gap-2 border-t border-border pt-3">
          <Quotes size={13} weight="fill" aria-hidden className="mt-1 shrink-0 text-muted" />
          <p className="font-serif text-xs italic leading-5 text-foreground-secondary">
            <mark className="bg-highlight text-foreground">{FRASE}</mark>{" "}
            <span className="not-italic text-accent">ver en el documento</span>
          </p>
        </div>
      </article>
    </div>
  );
}
