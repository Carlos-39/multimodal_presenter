"use client";

import type { DetailLevel } from "@/lib/detail";
import type { NarrationStatus } from "@/hooks/useNarration";
import type { GroundingReport, Section } from "@/lib/types";
import { GroundingIndicator } from "@/components/GroundingIndicator";
import { SectionNav } from "./SectionNav";
import { DetailLevelControl } from "./DetailLevelControl";
import { AudioControls } from "./AudioControls";

/**
 * Núcleo estructural fijo (Stable Core Pattern, Punto 8).
 *
 * El marco —header y rail de navegación/controles— NO cambia según el contenido generado.
 * Lo dinámico es `children` (contenido + columnas opcionales, que gestiona `Workspace`).
 *
 * Cambio consciente en el Hito 5e: el chat dejó de ser un rail SIEMPRE presente (como en el
 * Hito 3) y pasó a ser una COLUMNA OPCIONAL de la Escala 2 (`Workspace`), gobernada desde este
 * header por un toggle. El nav sí sigue fijo: nunca compite por espacio.
 */
interface AppShellProps {
  sections: Section[];
  grounding: GroundingReport | null;
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  detailLevel: DetailLevel;
  onDetailLevelChange: (level: DetailLevel) => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  slidesOpen: boolean;
  slidesAvailable: boolean;
  onToggleSlides: () => void;
  deckOpen: boolean;
  deckAvailable: boolean;
  deckLoading: boolean;
  onToggleDeck: () => void;
  narrationStatus: NarrationStatus;
  narrationAvailable: boolean;
  onNarrationPlay: () => void;
  onNarrationPause: () => void;
  onNarrationStop: () => void;
  children: React.ReactNode;
}

export function AppShell({
  sections,
  grounding,
  activeSectionId,
  onSelectSection,
  detailLevel,
  onDetailLevelChange,
  chatOpen,
  onToggleChat,
  slidesOpen,
  slidesAvailable,
  onToggleSlides,
  deckOpen,
  deckAvailable,
  deckLoading,
  onToggleDeck,
  narrationStatus,
  narrationAvailable,
  onNarrationPlay,
  onNarrationPause,
  onNarrationStop,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col">
      {/* Header fijo */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Multimodal Presenter
          </span>
          <span className="text-xs text-muted">prototipo</span>
        </div>
        <div className="flex items-center gap-4">
          <DetailLevelControl level={detailLevel} onChange={onDetailLevelChange} />
          <GroundingIndicator grounding={grounding} />
          <button
            type="button"
            onClick={onToggleSlides}
            aria-pressed={slidesOpen}
            disabled={!slidesAvailable}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
              slidesOpen
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Slides
          </button>
          <button
            type="button"
            onClick={onToggleDeck}
            aria-pressed={deckOpen}
            disabled={!deckAvailable || deckLoading}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
              deckOpen
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {deckLoading ? "Generando…" : "Presentación"}
          </button>
          <button
            type="button"
            onClick={onToggleChat}
            aria-pressed={chatOpen}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              chatOpen
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Chat
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Rail izquierdo fijo: navegación + audio */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <SectionNav
            sections={sections}
            activeSectionId={activeSectionId}
            onSelectSection={onSelectSection}
          />
          <div className="mt-auto border-t border-border">
            <AudioControls
              status={narrationStatus}
              available={narrationAvailable}
              onPlay={onNarrationPlay}
              onPause={onNarrationPause}
              onStop={onNarrationStop}
            />
          </div>
        </aside>

        {/* Zona dinámica: contenido + columnas opcionales (Workspace, Escala 2 del Hito 5e) */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
