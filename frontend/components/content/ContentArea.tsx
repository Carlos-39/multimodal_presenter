"use client";

import { useEffect } from "react";
import type { DetailLevel } from "@/lib/detail";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionCard } from "./SectionCard";
import { SectionSkeleton, SkeletonLine } from "./Skeleton";

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
  streaming?: boolean; // la transformación sigue en curso: aún pueden llegar secciones
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
  streaming = false,
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
      {title ? (
        <h1 className="text-balance font-serif text-[1.75rem] font-semibold leading-[2.125rem] tracking-[-0.012em] text-foreground">
          {title}
        </h1>
      ) : streaming ? (
        // El título llega con el primer evento del stream; hasta entonces, su hueco.
        <SkeletonLine className="h-7 w-3/5" />
      ) : null}

      {sections.map((section, i) => (
        <SectionCard
          key={section.id}
          section={section}
          index={i}
          chartNotes={chartNotes}
          observations={observations}
          groundingBySection={groundingBySection}
          onOpenSource={onOpenSource}
          activeSourceKey={activeSourceKey}
          active={section.id === activeSectionId}
          anchorId
        />
      ))}

      {/* Mientras dura el streaming, el hueco de la sección que viene: avisa que falta contenido
          y evita que la página "termine" antes de tiempo. Desaparece con el evento final. */}
      {streaming ? <SectionSkeleton /> : null}
    </div>
  );
}
