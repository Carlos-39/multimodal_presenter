import type { TimelineContent } from "@/lib/types";

/**
 * Línea de tiempo. Con espacio suficiente se lee en dos columnas (la fecha a la izquierda, el
 * hecho a la derecha, y la línea entre ambas); en contenedores angostos (p. ej. una respuesta del
 * chat) la fecha pasa encima del hecho. Depende del ancho del CONTENEDOR, no de la ventana.
 */
export function TimelineSection({ content }: { content: TimelineContent }) {
  return (
    <div className="@container">
      <ol>
        {content.events.map((event, i) => {
          const last = i === content.events.length - 1;
          return (
            <li key={i} className="grid grid-cols-[auto_1fr] gap-x-4 @md:grid-cols-[8rem_auto_1fr]">
              <div className="hidden pt-0.5 text-right text-[0.8125rem] leading-6 text-muted @md:block">
                {event.date}
              </div>

              {/* Marcador + tramo de línea hasta el siguiente hecho. */}
              <div className="flex flex-col items-center" aria-hidden>
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                {last ? null : <span className="mt-1 w-px flex-1 bg-border" />}
              </div>

              <div className={last ? "" : "pb-5"}>
                <div className="text-xs font-medium leading-5 text-muted @md:hidden">{event.date}</div>
                <div className="font-serif text-base font-semibold leading-6 text-foreground">
                  {event.label}
                </div>
                {event.description ? (
                  <p className="mt-0.5 font-serif text-[0.9375rem] leading-6 text-foreground-secondary">
                    {event.description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
