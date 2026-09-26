"use client";

import type { DetailLevel } from "@/lib/detail";
import type { GroundingReport, Section } from "@/lib/types";
import { GroundingIndicator } from "@/components/GroundingIndicator";
import { SectionNav } from "./SectionNav";
import { DetailLevelControl } from "./DetailLevelControl";
import { AudioControls } from "./AudioControls";
import { ChatPanel } from "./ChatPanel";

/**
 * Núcleo estructural fijo (Stable Core Pattern, Punto 8).
 *
 * El marco —header, rail de navegación/controles y rail de chat— NO cambia según el
 * contenido generado. Lo único dinámico es `children` (el slot de contenido). Los
 * controles que aún no tienen función (detalle, audio, chat) existen ya como
 * placeholders para que los Hitos 5/6 solo los "llenen" sin mover la estructura.
 */
interface AppShellProps {
  sections: Section[];
  grounding: GroundingReport | null;
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  detailLevel: DetailLevel;
  onDetailLevelChange: (level: DetailLevel) => void;
  children: React.ReactNode;
}

export function AppShell({
  sections,
  grounding,
  activeSectionId,
  onSelectSection,
  detailLevel,
  onDetailLevelChange,
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
            <AudioControls />
          </div>
        </aside>

        {/* Zona dinámica: lo ÚNICO que varía entre presentaciones */}
        <main className="flex-1 overflow-hidden">{children}</main>

        {/* Rail derecho fijo: estructura del chat */}
        <aside className="hidden w-72 shrink-0 border-l border-border bg-surface lg:block">
          <ChatPanel />
        </aside>
      </div>
    </div>
  );
}
