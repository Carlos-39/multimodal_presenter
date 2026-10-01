"use client";

import { useEffect, useState } from "react";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionCard } from "./SectionCard";

/**
 * Vista de slides (Hito 5h Parte 2). Forma ALTERNATIVA de consumir el MISMO contenido ya generado
 * y verificado — NO genera nada nuevo. Una `Section` visible = una slide (respeta el toggle
 * resumen/detallado, que decide qué secciones son visibles). Reusa `SectionCard`, así el render y
 * la atribución de fuente son idénticos a la vista de scroll; la trazabilidad no se pierde por
 * cambiar de vista. (La composición interna multi-tipo —Escala 1 del 5e— queda como mejora futura.)
 */
interface SlideViewProps {
  title: string;
  sections: Section[]; // ya filtradas por nivel de detalle
  chartNotes?: ChartNote[];
  observations?: SemanticObservation[];
  groundingBySection?: Record<string, GroundingStatus>;
  onOpenSource?: (section: Section) => void;
  activeSourceKey?: string | null;
}

export function SlideView({
  title,
  sections,
  chartNotes = [],
  observations = [],
  groundingBySection = {},
  onOpenSource,
  activeSourceKey = null,
}: SlideViewProps) {
  const [index, setIndex] = useState(0);
  const total = sections.length;
  // `shown` se recorta siempre al rango válido: si el deck encoge (p. ej. al pasar a modo resumen)
  // no hace falta resetear estado en un efecto (lo que la regla de hooks del proyecto evita).
  const shown = total > 0 ? Math.min(index, total - 1) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && /INPUT|TEXTAREA/.test(el.tagName)) return; // no robar teclas al escribir
      if (e.key === "ArrowRight") setIndex((i) => Math.min(total - 1, Math.min(i, total - 1) + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, Math.min(i, total - 1) - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (total === 0) return null;
  const section = sections[shown];
  const go = (delta: number) => setIndex(Math.max(0, Math.min(total - 1, shown + delta)));

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        <span className="tabular shrink-0 text-xs text-muted">
          {shown + 1} / {total}
        </span>
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
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={shown === 0}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
        >
          ← Anterior
        </button>
        <span className="hidden text-xs text-muted sm:block">Usa ← → para navegar</span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={shown === total - 1}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
