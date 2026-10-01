import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

/**
 * Navegación entre diapositivas: anterior / siguiente, y en medio el progreso (un punto por
 * diapositiva, cada uno lleva a la suya) con el contador. La comparten la vista de slides y la
 * presentación generada, para que pasar de diapositiva se haga igual en las dos.
 */
interface SlideNavProps {
  index: number; // 0-based
  total: number;
  onGo: (index: number) => void;
}

// Con muchas diapositivas los puntos dejan de leerse: queda solo el contador.
const MAX_DOTS = 24;

const STEP_BUTTON =
  "flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[0.8125rem] text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground active:scale-[0.98] disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground-secondary";

export function SlideNav({ index, total, onGo }: SlideNavProps) {
  return (
    <nav
      className="flex items-center justify-between gap-3"
      aria-label="Diapositivas"
      title="También con las flechas del teclado"
    >
      <button type="button" onClick={() => onGo(index - 1)} disabled={index === 0} className={STEP_BUTTON}>
        <CaretLeft size={14} aria-hidden />
        Anterior
      </button>

      <div className="flex min-w-0 items-center gap-3">
        {total <= MAX_DOTS ? (
          <ol className="hidden items-center gap-1 sm:flex">
            {Array.from({ length: total }, (_, i) => (
              <li key={i} className="flex">
                {/* Área de clic más alta que el punto visible, para que sea fácil de acertar. */}
                <button
                  type="button"
                  onClick={() => onGo(i)}
                  aria-label={`Ir a la diapositiva ${i + 1} de ${total}`}
                  aria-current={i === index ? "true" : undefined}
                  className="group flex h-5 items-center px-0.5"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                      i === index ? "w-5 bg-accent" : "w-1.5 bg-border-strong group-hover:bg-foreground"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        <span className="tabular shrink-0 text-xs text-muted">
          {index + 1} / {total}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onGo(index + 1)}
        disabled={index === total - 1}
        className={STEP_BUTTON}
      >
        Siguiente
        <CaretRight size={14} aria-hidden />
      </button>
    </nav>
  );
}
