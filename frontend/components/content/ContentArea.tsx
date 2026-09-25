"use client";

import { useEffect } from "react";
import type { Presentation } from "@/lib/types";
import { SectionRenderer } from "./SectionRenderer";

/**
 * Zona de contenido dinámico: lo ÚNICO que varía entre presentaciones. Recorre las
 * secciones y las despacha por tipo. La atribución de fuente se muestra como texto
 * (no interactivo); el resaltado sobre el documento original es Hito 5.
 */
interface ContentAreaProps {
  presentation: Presentation;
  activeSectionId: string | null;
}

export function ContentArea({ presentation, activeSectionId }: ContentAreaProps) {
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

      {presentation.sections.map((section, i) => (
        <section
          key={section.id}
          id={`section-${section.id}`}
          className={`scroll-mt-4 rounded-lg border bg-surface p-5 ${
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

          <footer className="mt-4 border-t border-border pt-2 text-xs text-muted">
            Fuente: “{section.source.quote}”
          </footer>
        </section>
      ))}
    </div>
  );
}
