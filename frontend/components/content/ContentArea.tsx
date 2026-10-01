"use client";

import { useEffect } from "react";
import type { DetailLevel } from "@/lib/detail";
import { isAnchored, UNANCHORED_NOTICE } from "@/lib/grounding";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionRenderer } from "./SectionRenderer";

/**
 * Zona de contenido dinámico. Renderiza SOLO las secciones visibles según el nivel de detalle
 * (el filtrado vive en `lib/detail.ts`). Los satélites se muestran "recesados" (borde
 * izquierdo + peso menor) para leerse como profundidad adicional, no como ruido.
 */
interface ContentAreaProps {
  title: string;
  sections: Section[];
  level: DetailLevel;
  activeSectionId: string | null;
  chartNotes?: ChartNote[];
  observations?: SemanticObservation[];
  onOpenSource?: (section: Section) => void;
  activeSourceKey?: string | null;
  groundingBySection?: Record<string, GroundingStatus>; // estado de anclaje por sección (Hito 8)
}

export function ContentArea({
  title,
  sections,
  level,
  activeSectionId,
  chartNotes = [],
  observations = [],
  onOpenSource,
  activeSourceKey = null,
  groundingBySection = {},
}: ContentAreaProps) {
  // Re-ancla la vista a la sección activa al navegar o al cambiar de nivel (no perder el lugar).
  useEffect(() => {
    if (!activeSectionId) return;
    document
      .getElementById(`section-${activeSectionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSectionId, level]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 pb-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>

      {sections.map((section, i) => {
        const degraded = chartNotes.find(
          (n) => n.section_id === section.id && n.kind === "degraded",
        );
        const observation = observations.find((o) => o.section_id === section.id);
        const isSatellite = section.role === "satellite";
        const active = section.id === activeSectionId;
        const status = groundingBySection[section.id] ?? "unverified";
        const anchored = isAnchored(status);

        return (
          <section
            key={section.id}
            id={`section-${section.id}`}
            className={`section-enter scroll-mt-4 rounded-md border bg-surface p-5 ${
              active ? "border-accent" : "border-border"
            } ${isSatellite ? "border-l-2 border-l-muted" : ""}`}
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2
                className={`text-base font-medium ${
                  isSatellite ? "text-muted" : "text-foreground"
                }`}
              >
                {section.title ?? `Sección ${i + 1}`}
              </h2>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                {isSatellite ? "satélite · detalle" : "núcleo"}
              </span>
            </header>

            <SectionRenderer section={section} />

            {degraded ? <p className="mt-3 text-xs text-muted">{degraded.detail}</p> : null}

            {observation ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-warning"
                  aria-hidden
                />
                <span>Posible discrepancia con la fuente: {observation.issue}</span>
              </p>
            ) : null}

            <footer className="mt-4 border-t border-border pt-2">
              {anchored ? (
                <button
                  type="button"
                  onClick={() => onOpenSource?.(section)}
                  className={`text-left text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline ${
                    section.id === activeSourceKey ? "text-foreground underline" : "text-muted"
                  }`}
                >
                  Fuente: “{section.source.quote}” · ver en el documento
                </button>
              ) : (
                // not_found (Hito 8): NO se ofrece "ver fuente" (sería fingir una cita que no
                // ancla); aviso honesto, como el chat. No se descarta la sección.
                <p className="flex items-start gap-1.5 text-xs text-warning">
                  <span
                    className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-warning"
                    aria-hidden
                  />
                  <span>{UNANCHORED_NOTICE}</span>
                </p>
              )}
            </footer>
          </section>
        );
      })}
    </div>
  );
}
