import { Espera } from "@/components/shell/Espera";

/**
 * Estado de la transformación en curso (streaming, Hito 5d): dice que se está generando, cuánto
 * llevas esperando y cuántas secciones ya llegaron. Se anuncia a lectores de pantalla
 * (`role="status"`).
 *
 * El contador y el reloj se reparten el trabajo: el contador dice que AVANZA, el reloj dice que
 * sigue VIVA. Hasta que llega la primera sección no hay contador que valga —esos segundos son
 * ciegos— y es justo donde el reloj es lo único que hay.
 */
export function StreamingStatus({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-2 text-[0.8125rem] text-muted" role="status">
      <Espera className="text-accent" />
      <span>
        {count === 0 ? (
          "Leyendo el documento y preparando las secciones…"
        ) : (
          <>
            Generando el contenido. <span className="tabular">{count}</span>{" "}
            {count === 1 ? "sección lista" : "secciones listas"}.
          </>
        )}
      </span>
    </p>
  );
}
