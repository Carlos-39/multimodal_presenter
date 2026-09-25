"use client";

import { useEffect } from "react";
import type {
  ChartNote,
  Presentation,
  SemanticObservation,
} from "@/lib/types";
import { SectionRenderer } from "./SectionRenderer";

/**
 * Zona de contenido dinámico: lo ÚNICO que varía entre presentaciones. Recorre las
 * secciones y las despacha por tipo. Muestra, por sección, la leyenda de degradación de
 * gráfico (isomorfismo) y la marca de una observación semántica, si las hay.
 */
interface ContentAreaProps {
  presentation: Presentation;
  activeSectionId: string | null;
  chartNotes?: ChartNote[];
  observations?: SemanticObservation[];
}

export function ContentArea({
  presentation,
  activeSectionId,
  chartNotes = [],
  observations = [],
}: ContentAreaProps) {
  useEffect(() => {
    if (!activeSectionId) return;
    document
      .getElementById(`section-${activeSectionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSectionId]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 pb-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {presentation.title}
      </h1>

      {presentation.sections.map((section, i) => {
        const degraded = chartNotes.find(
          (n) => n.section_id === section.id && n.kind === "degraded",
        );
        const observation = observations.find((o) => o.section_id === section.id);

        return (
          <section
            key={section.id}
            id={`section-${section.id}`}
            className={`scroll-mt-4 rounded-md border bg-surface p-5 ${
              section.id === activeSectionId ? "border-accent" : "border-border"
            }`}
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-medium text-foreground">
                {section.title ?? `Sección ${i + 1}`}
              </h2>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                {section.role === "core" ? "núcleo" : "satélite"}
              </span>
            </header>

            <SectionRenderer section={section} />

            {degraded ? (
              <p className="mt-3 text-xs text-muted">{degraded.detail}</p>
            ) : null}

            {observation ? (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-warning"
                  aria-hidden
                />
                <span>Posible discrepancia con la fuente: {observation.issue}</span>
              </p>
            ) : null}

            <footer className="mt-4 border-t border-border pt-2 text-xs text-muted">
              Fuente: “{section.source.quote}”
            </footer>
          </section>
        );
      })}
    </div>
  );
}
