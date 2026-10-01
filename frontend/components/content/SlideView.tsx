"use client";

import { useCallback } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { useSlideKeys } from "@/hooks/useSlideKeys";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionCard } from "./SectionCard";
import { SlideNav } from "./SlideNav";

/**
 * Vista de slides (Hito 5h Parte 2). Forma ALTERNATIVA de consumir el MISMO contenido ya generado
 * y verificado — NO genera nada nuevo. Una `Section` visible = una slide (respeta el toggle
 * resumen/detallado, que decide qué secciones son visibles). Reusa `SectionCard`, así el render y
 * la atribución de fuente son idénticos a la vista de scroll; la trazabilidad no se pierde por
 * cambiar de vista. (La composición interna multi-tipo —Escala 1 del 5e— queda como mejora futura.)
 *
 * La slide visible ES la sección activa de la app (no un índice propio): así el rail de secciones,
 * la vista de scroll y las slides apuntan siempre a lo mismo. Elegir una sección en el rail cambia
 * de slide, y avanzar de slide mueve la sección activa (al volver a "Documento" se cae en ella).
 */
interface SlideViewProps {
  title: string;
  sections: Section[]; // ya filtradas por nivel de detalle
  chartNotes?: ChartNote[];
  observations?: SemanticObservation[];
  groundingBySection?: Record<string, GroundingStatus>;
  onOpenSource?: (section: Section) => void;
  activeSourceKey?: string | null;
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  streaming?: boolean; // la transformación sigue en curso: aún pueden llegar slides
  illustrationsPending?: boolean; // se están preparando ilustraciones de apoyo
}

export function SlideView({
  title,
  sections,
  chartNotes = [],
  observations = [],
  groundingBySection = {},
  onOpenSource,
  activeSourceKey = null,
  activeSectionId,
  onSelectSection,
  streaming = false,
  illustrationsPending = false,
}: SlideViewProps) {
  const total = sections.length;
  // Derivado, sin estado propio: si la sección activa no está entre las visibles (p. ej. al pasar
  // a modo resumen) se cae a la primera, igual que hace el resto de la app.
  const shown = Math.max(
    0,
    sections.findIndex((s) => s.id === activeSectionId),
  );

  const goTo = useCallback(
    (i: number) => {
      const next = sections[Math.max(0, Math.min(total - 1, i))];
      if (next) onSelectSection(next.id);
    },
    [sections, total, onSelectSection],
  );
  const step = useCallback((delta: 1 | -1) => goTo(shown + delta), [goTo, shown]);
  useSlideKeys(step);

  if (total === 0) return null;
  const section = sections[shown];

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="truncate font-serif text-[1.375rem] font-semibold leading-7 tracking-[-0.01em] text-foreground">
          {title}
        </h1>
        {streaming || illustrationsPending ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted" role="status">
            <CircleNotch size={12} className="animate-spin text-accent" aria-hidden />
            {streaming ? "Llegando más" : "Preparando ilustraciones"}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* `key` por slide → la animación de entrada se reproduce al cambiar de diapositiva. */}
        <SectionCard
          key={section.id}
          section={section}
          index={shown}
          chartNotes={chartNotes}
          observations={observations}
          groundingBySection={groundingBySection}
          onOpenSource={onOpenSource}
          activeSourceKey={activeSourceKey}
          slide
        />
      </div>

      <div className="mt-4">
        <SlideNav index={shown} total={total} onGo={goTo} />
      </div>
    </div>
  );
}
