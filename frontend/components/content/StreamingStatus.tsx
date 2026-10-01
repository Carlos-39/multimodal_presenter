import { CircleNotch } from "@phosphor-icons/react/dist/ssr";

/**
 * Estado de la transformación en curso (streaming, Hito 5d): dice que se está generando y cuántas
 * secciones ya llegaron. Se anuncia a lectores de pantalla (`role="status"`).
 */
export function StreamingStatus({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-2 text-[0.8125rem] text-muted" role="status">
      <CircleNotch size={14} className="shrink-0 animate-spin text-accent" aria-hidden />
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
