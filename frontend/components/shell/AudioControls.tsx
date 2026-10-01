import { CircleNotch, Pause, Play, Stop } from "@phosphor-icons/react/dist/ssr";
import type { NarrationStatus } from "@/hooks/useNarration";

/**
 * Controles de la narración tipo audiolibro (núcleo fijo, Punto 8 · Hito 5g Parte 3). Viven
 * dentro del bloque "Generar" del rail (`GeneratePanel`), junto a la presentación.
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
    <div className="mt-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          disabled={disabled}
          aria-label={playing ? "Pausar narración" : "Reproducir narración"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent transition-colors hover:text-accent-hover active:scale-95 disabled:opacity-45 disabled:hover:text-accent"
        >
          {loading ? (
            <CircleNotch size={15} className="animate-spin" aria-hidden />
          ) : playing ? (
            <Pause size={15} weight="fill" aria-hidden />
          ) : (
            <Play size={15} weight="fill" aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={onStop}
          disabled={status !== "playing" && status !== "paused"}
          aria-label="Detener narración"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          <Stop size={14} weight="fill" aria-hidden />
        </button>

        {/* El estado se muestra COMPLETO (puede ocupar dos líneas): nunca recortado con "…". */}
        <span
          className={`min-w-0 flex-1 text-xs leading-4 ${status === "error" ? "text-warning" : "text-muted"}`}
          aria-live="polite"
        >
          {!available
            ? "Disponible con un documento"
            : loading
              ? "Generando la narración…"
              : status === "error"
                ? "No se pudo generar la narración."
                : playing
                  ? "Reproduciendo"
                  : status === "paused"
                    ? "En pausa"
                    : "Pulsa para escuchar"}
        </span>
      </div>

      {loading ? <div className="progress-indeterminate mt-2.5" aria-hidden /> : null}

      {status === "error" ? (
        <button
          type="button"
          onClick={onPlay}
          className="mt-2 text-xs text-accent underline decoration-1 underline-offset-2 hover:text-accent-hover"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
