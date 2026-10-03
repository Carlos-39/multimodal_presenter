"use client";

import { CircleNotch, Presentation, SpeakerHigh } from "@phosphor-icons/react";
import type { NarrationStatus } from "@/hooks/useNarration";
import { AudioControls } from "./AudioControls";

/**
 * "Generar": lo que el sistema puede CREAR a partir del documento, reunido en un solo lugar del
 * núcleo fijo (rail). Hoy son dos piezas —la presentación en diapositivas y la narración— y cada
 * una dice en una línea qué es, para no confundirse con las formas de VER el contenido ya
 * generado (Documento / Slides, en el header). Añadir otro generador = añadir otro bloque aquí.
 *
 * No genera nada por sí mismo: solo dispara los manejadores que ya existían (`onToggleDeck`,
 * narración). Nunca hay generación automática.
 */
interface GeneratePanelProps {
  deckOpen: boolean;
  deckReady: boolean; // ya se generó (abrirla es instantáneo)
  deckAvailable: boolean;
  deckLoading: boolean;
  deckError: boolean;
  onToggleDeck: () => void;
  narrationStatus: NarrationStatus;
  narrationAvailable: boolean;
  onNarrationPlay: () => void;
  onNarrationPause: () => void;
  onNarrationStop: () => void;
  narrationCurrentTime: number;
  narrationDuration: number;
  onNarrationSeek: (segundos: number) => void;
  onNarrationSkip: (delta: number) => void;
}

export function GeneratePanel({
  deckOpen,
  deckReady,
  deckAvailable,
  deckLoading,
  deckError,
  onToggleDeck,
  narrationStatus,
  narrationAvailable,
  onNarrationPlay,
  onNarrationPause,
  onNarrationStop,
  narrationCurrentTime,
  narrationDuration,
  onNarrationSeek,
  onNarrationSkip,
}: GeneratePanelProps) {
  const hasDocument = deckAvailable || narrationAvailable;

  return (
    <section className="p-3" aria-labelledby="generate-heading">
      <h2 id="generate-heading" className="px-1 text-[0.8125rem] font-medium text-foreground">
        Generar
      </h2>
      <p className="px-1 pb-2 text-xs leading-4 text-muted">
        {hasDocument ? "Piezas nuevas a partir de tu documento." : "Transforma un documento para empezar."}
      </p>

      <div className="divide-y divide-border rounded-lg border border-border bg-background">
        <div className="p-3">
          <ItemHeading icon={<Presentation size={16} aria-hidden />} title="Presentación">
            Diapositivas con guion propio, listas para exponer.
          </ItemHeading>

          {deckError ? (
            <p className="mt-2 text-xs text-warning">No se pudo generar la presentación.</p>
          ) : null}
          {deckLoading ? (
            <div className="mt-2.5" role="status">
              <div className="progress-indeterminate" aria-hidden />
              <p className="mt-2 text-xs leading-4 text-muted">
                {deckReady
                  ? "Recuperando las diapositivas que guardaste."
                  : "Puedes seguir leyendo: se abrirá sola al terminar."}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onToggleDeck}
            aria-pressed={deckReady ? deckOpen : undefined}
            disabled={!deckAvailable || deckLoading}
            className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-45 ${
              deckOpen
                ? "border border-border-strong text-foreground hover:bg-surface-sunken"
                : deckReady
                  ? "bg-accent-subtle text-accent hover:text-accent-hover"
                  : "bg-accent text-accent-foreground hover:bg-accent-hover disabled:hover:bg-accent"
            }`}
          >
            {deckLoading ? <CircleNotch size={14} className="animate-spin" aria-hidden /> : null}
            {deckLoading
              ? deckReady
                ? "Abriendo…"
                : "Generando…"
              : deckOpen
                ? "Volver al documento"
                : deckReady
                  ? "Abrir presentación"
                  : deckError
                    ? "Reintentar"
                    : "Generar presentación"}
          </button>
        </div>

        <div className="p-3">
          <ItemHeading icon={<SpeakerHigh size={16} aria-hidden />} title="Narración">
            Un resumen del documento para escuchar.
          </ItemHeading>
          <AudioControls
            status={narrationStatus}
            available={narrationAvailable}
            currentTime={narrationCurrentTime}
            duration={narrationDuration}
            onPlay={onNarrationPlay}
            onPause={onNarrationPause}
            onStop={onNarrationStop}
            onSeek={onNarrationSeek}
            onSkip={onNarrationSkip}
          />
        </div>
      </div>
    </section>
  );
}

function ItemHeading({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <div className="min-w-0">
        <h3 className="text-[0.8125rem] font-medium leading-5 text-foreground">{title}</h3>
        <p className="text-xs leading-4 text-muted">{children}</p>
      </div>
    </div>
  );
}
