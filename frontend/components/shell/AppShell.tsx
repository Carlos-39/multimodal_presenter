"use client";

import type { DetailLevel } from "@/lib/detail";
import type { NarrationStatus } from "@/hooks/useNarration";
import type { GroundingReport, Section } from "@/lib/types";
import { GroundingIndicator } from "@/components/GroundingIndicator";
import { SectionNav } from "./SectionNav";
import { DetailLevelControl } from "./DetailLevelControl";
import { GeneratePanel } from "./GeneratePanel";
import { Segmented } from "./Segmented";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Núcleo estructural fijo (Stable Core Pattern, Punto 8).
 *
 * El marco —header y rail de navegación/controles— NO cambia según el contenido generado.
 * Lo dinámico es `children` (contenido + columnas opcionales, que gestiona `Workspace`).
 *
 * Dos familias de controles, separadas a propósito para que no se confundan:
 * - VER (header): cómo se muestra el contenido YA generado — Documento | Slides y Resumen |
 *   Detallado. No generan nada.
 * - GENERAR (rail, `GeneratePanel`): piezas NUEVAS a partir del documento — presentación y
 *   narración.
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
  deckReady: boolean; // la presentación ya se generó
  deckAvailable: boolean;
  deckLoading: boolean;
  deckError: boolean;
  onToggleDeck: () => void;
  narrationStatus: NarrationStatus;
  narrationAvailable: boolean;
  onNarrationPlay: () => void;
  onNarrationPause: () => void;
  onNarrationStop: () => void;
  children: React.ReactNode;
}

type ViewMode = "document" | "slides";

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
  children,
}: AppShellProps) {
  // Con la presentación generada abierta no hay vista "Documento | Slides" seleccionada.
  const viewMode: ViewMode | null = deckOpen ? null : slidesOpen ? "slides" : "document";

  // Se apoya en los manejadores existentes (cada uno ya cierra la otra vista).
  function handleViewChange(next: ViewMode) {
    if (next === "slides") {
      if (!slidesOpen) onToggleSlides();
    } else if (slidesOpen) {
      onToggleSlides();
    } else if (deckOpen) {
      onToggleDeck();
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header fijo */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
            Multimodal Presenter
          </span>
          <span className="hidden text-xs text-muted lg:inline">prototipo</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <GroundingIndicator grounding={grounding} />
          <div className="flex items-center gap-2 border-border sm:border-l sm:pl-3">
            <span className="hidden text-xs text-muted lg:inline">Ver</span>
            <Segmented<ViewMode>
              label="Vista del contenido"
              value={viewMode}
              onChange={handleViewChange}
              options={[
                { value: "document", label: "Documento" },
                { value: "slides", label: "Slides", disabled: !slidesAvailable },
              ]}
            />
            <DetailLevelControl level={detailLevel} onChange={onDetailLevelChange} />
          </div>
          <div className="flex items-center gap-2 border-border sm:border-l sm:pl-3">
            {/* En pantallas angostas el rail (y con él "Generar") no se muestra: la presentación
                conserva aquí un acceso directo, como antes. */}
            <button
              type="button"
              onClick={onToggleDeck}
              aria-pressed={deckOpen}
              disabled={!deckAvailable || deckLoading}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 md:hidden ${
                deckOpen
                  ? "border-accent bg-accent-subtle font-medium text-accent"
                  : deckError
                    ? "border-warning text-warning"
                    : "border-border text-foreground-secondary hover:text-foreground"
              }`}
            >
              {deckLoading ? "Generando…" : deckError ? "Reintentar" : "Presentación"}
            </button>
            <button
              type="button"
              onClick={onToggleChat}
              aria-pressed={chatOpen}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                chatOpen
                  ? "border-accent bg-accent-subtle font-medium text-accent"
                  : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground"
              }`}
            >
              Chat
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Rail izquierdo fijo: navegación + lo que se puede generar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <SectionNav
            sections={sections}
            activeSectionId={activeSectionId}
            onSelectSection={onSelectSection}
          />
          <div className="shrink-0 border-t border-border">
            <GeneratePanel
              deckOpen={deckOpen}
              deckReady={deckReady}
              deckAvailable={deckAvailable}
              deckLoading={deckLoading}
              deckError={deckError}
              onToggleDeck={onToggleDeck}
              narrationStatus={narrationStatus}
              narrationAvailable={narrationAvailable}
              onNarrationPlay={onNarrationPlay}
              onNarrationPause={onNarrationPause}
              onNarrationStop={onNarrationStop}
            />
          </div>
        </aside>

        {/* Zona dinámica: contenido + columnas opcionales (Workspace, Escala 2 del Hito 5e) */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
