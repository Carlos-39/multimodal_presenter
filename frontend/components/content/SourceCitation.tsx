/**
 * Cita a la fuente (rastro de verificación). Pieza ÚNICA para las tres superficies que anclan
 * contenido —secciones, respuestas del chat y slides de la presentación generada—, para que la
 * trazabilidad se vea y se use igual en todas.
 *
 * La muestra de resaltador anuncia el color con que el pasaje aparece marcado en el documento;
 * con el panel abierto en esta cita (`active`), la cita misma queda resaltada.
 */
interface SourceCitationProps {
  children: React.ReactNode; // el fragmento citado, o una referencia ("página 3")
  onOpen: () => void;
  quoted?: boolean; // true: es una cita textual (comillas + cursiva)
  active?: boolean;
  action?: string;
}

export function SourceCitation({
  children,
  onOpen,
  quoted = true,
  active = false,
  action = "ver en el documento",
}: SourceCitationProps) {
  const tone = active
    ? "bg-highlight px-1 text-foreground"
    : "text-foreground-secondary group-hover:text-foreground";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-wrap items-baseline gap-x-2 gap-y-1 text-left text-xs text-muted"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-[2px] bg-highlight ring-1 ring-border"
        aria-hidden
      />
      <span className="shrink-0">Fuente</span>
      {quoted ? (
        <q
          className={`min-w-0 flex-1 basis-32 rounded-sm font-serif text-[0.8125rem] italic leading-5 transition-colors ${tone}`}
        >
          {children}
        </q>
      ) : (
        <span className={`min-w-0 flex-1 basis-32 rounded-sm transition-colors ${tone}`}>
          {children}
        </span>
      )}
      <span className="ml-auto shrink-0 text-accent underline decoration-1 underline-offset-2 group-hover:text-accent-hover">
        {action}
      </span>
    </button>
  );
}

/** Aviso honesto de contenido NO anclado (mismo trato en secciones, chat y presentación). */
export function UnanchoredNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-warning">
      <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
