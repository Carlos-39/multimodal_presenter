import type { NarrationStatus } from "@/hooks/useNarration";

/**
 * Controles de la narración tipo audiolibro (núcleo fijo, Punto 8 · Hito 5g Parte 3).
 *
 * Reproduce una narración generada aparte (guion sintetizado, NO el texto en pantalla). Nunca
 * autoplay: solo arranca si el usuario pulsa reproducir. Si el TTS falla, se dice (honestidad).
 */
interface AudioControlsProps {
  status: NarrationStatus;
  available: boolean; // hay contenido que narrar
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function AudioControls({ status, available, onPlay, onPause, onStop }: AudioControlsProps) {
  const playing = status === "playing";
  const loading = status === "loading";
  const disabled = !available || loading;

  return (
    <div className="p-3">
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Narración
      </h2>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          disabled={disabled}
          aria-label={playing ? "Pausar narración" : "Reproducir narración"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-accent hover:text-accent active:scale-95 disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-accent" />
          ) : playing ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        <button
          type="button"
          onClick={onStop}
          disabled={status !== "playing" && status !== "paused"}
          aria-label="Detener narración"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted"
        >
          <StopIcon />
        </button>

        <span className="min-w-0 flex-1 truncate text-xs text-muted">
          {!available
            ? "Transforma un documento"
            : loading
              ? "Generando narración…"
              : status === "error"
                ? "No se pudo generar la narración"
                : playing
                  ? "Reproduciendo"
                  : status === "paused"
                    ? "En pausa"
                    : "Escucha un resumen narrado"}
        </span>
      </div>

      {status === "error" ? (
        <button
          type="button"
          onClick={onPlay}
          className="mt-2 text-xs text-warning underline underline-offset-2 hover:text-foreground"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.5 3.3v9.4c0 .5.56.82.99.55l7.3-4.7a.65.65 0 0 0 0-1.1l-7.3-4.7a.65.65 0 0 0-.99.55Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
    </svg>
  );
}
