import { Pause, Play, Rewind, FastForward, Stop } from "@phosphor-icons/react/dist/ssr";
import { formatTimestamp } from "@/lib/audio";
import { NARRATION_SKIP_S, type NarrationStatus } from "@/hooks/useNarration";
import { Espera } from "./Espera";

/**
 * Controles de la narración tipo audiolibro (núcleo fijo, Punto 8 · Hito 5g Parte 3). Viven
 * dentro del bloque "Generar" del rail (`GeneratePanel`), junto a la presentación.
 *
 * Reproduce una narración generada aparte (guion sintetizado, NO el texto en pantalla). Nunca
 * autoplay: solo arranca si el usuario pulsa reproducir. Si el TTS falla, se dice (honestidad).
 *
 * La barra de progreso y los saltos de ±15 s solo aparecen cuando hay algo que recorrer (es
 * decir, cuando ya se conoce la duración): antes de reproducir no hay nada sobre lo que saltar,
 * y mostrar una barra vacía prometería un control que todavía no existe.
 */
interface AudioControlsProps {
  status: NarrationStatus;
  available: boolean; // hay contenido que narrar
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (segundos: number) => void;
  onSkip: (delta: number) => void;
}

export function AudioControls({
  status,
  available,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSkip,
}: AudioControlsProps) {
  const playing = status === "playing";
  const loading = status === "loading";
  const disabled = !available || loading;
  // Hay audio cargado y medido: solo entonces tiene sentido ofrecer recorrerlo.
  const recorrible = duration > 0 && (playing || status === "paused");

  return (
    <div className="mt-2.5">
      {/* `flex-wrap`: los cuatro botones no encogen (148 px con los huecos) y en el rail la fila
          mide 190, así que al estado le quedaban 42 px. Una palabra como "documento" no cabe ahí
          y no se puede partir, de modo que se salía del rail. Con el ancho mínimo de abajo, el
          estado baja a su propia línea cuando no cabe al lado, y se queda al lado cuando sí. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          disabled={disabled}
          aria-label={playing ? "Pausar narración" : "Reproducir narración"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent transition-colors hover:text-accent-hover active:scale-95 disabled:opacity-45 disabled:hover:text-accent"
        >
          {/* Mientras genera, este botón se queda quieto y deshabilitado: lo que está en marcha se
              cuenta abajo, con su reloj, y no hacen falta dos cosas girando en 190 px de rail. */}
          {playing ? (
            <Pause size={15} weight="fill" aria-hidden />
          ) : (
            <Play size={15} weight="fill" aria-hidden />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSkip(-NARRATION_SKIP_S)}
          disabled={!recorrible}
          aria-label={`Retroceder ${NARRATION_SKIP_S} segundos`}
          title={`Retroceder ${NARRATION_SKIP_S} s`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          <Rewind size={14} weight="fill" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => onSkip(NARRATION_SKIP_S)}
          disabled={!recorrible}
          aria-label={`Adelantar ${NARRATION_SKIP_S} segundos`}
          title={`Adelantar ${NARRATION_SKIP_S} s`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          <FastForward size={14} weight="fill" aria-hidden />
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

        {/* El estado se muestra COMPLETO (puede ocupar dos líneas): nunca recortado con "…". El
            ancho mínimo es lo que decide si cabe al lado de los botones o baja de línea. */}
        <span
          className={`min-w-[6.5rem] flex-1 text-xs leading-4 ${status === "error" ? "text-warning" : "text-muted"}`}
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

      {recorrible ? (
        <div className="mt-2.5 flex items-center gap-2">
          <span className="tabular shrink-0 text-[0.6875rem] text-muted">
            {formatTimestamp(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={Math.min(currentTime, duration)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Posición de la narración"
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-surface-sunken accent-accent"
          />
          <span className="tabular shrink-0 text-[0.6875rem] text-muted">
            {formatTimestamp(duration)}
          </span>
        </div>
      ) : null}

      {/* La misma pieza para los dos estados y en la misma posición, para que el reloj sobreviva al
          fallo y diga cuánto se estuvo intentando antes de rendirse. */}
      {loading || status === "error" ? (
        <div className="mt-2.5">
          <Espera
            estado={loading ? "trabajando" : "error"}
            className={loading ? "text-accent" : "text-warning"}
          />
        </div>
      ) : null}

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
