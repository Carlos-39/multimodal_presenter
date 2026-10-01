"use client";

import { useEffect } from "react";
import { CaretLeft, CaretRight, CircleNotch } from "@phosphor-icons/react";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionCard } from "./SectionCard";

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // otro control ya usó la tecla (p. ej. ajustar una columna)
      const el = e.target;
      if (el instanceof HTMLElement && /INPUT|TEXTAREA/.test(el.tagName)) return; // no robar teclas al escribir
      const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (delta === 0) return;
      const next = sections[Math.max(0, Math.min(total - 1, shown + delta))];
      if (next) onSelectSection(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sections, total, shown, onSelectSection]);

  if (total === 0) return null;
  const section = sections[shown];
  const go = (delta: number) => {
    const next = sections[Math.max(0, Math.min(total - 1, shown + delta))];
    if (next) onSelectSection(next.id);
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="truncate font-serif text-[1.375rem] font-semibold leading-7 tracking-[-0.01em] text-foreground">
          {title}
        </h1>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
          {streaming || illustrationsPending ? (
            <span className="flex items-center gap-1.5" role="status">
              <CircleNotch size={12} className="animate-spin text-accent" aria-hidden />
              {streaming ? "Llegando más" : "Preparando ilustraciones"}
            </span>
          ) : null}
          <span className="tabular">
            {shown + 1} / {total}
          </span>
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
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[0.8125rem] text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground active:scale-[0.98] disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground-secondary"
        >
          <CaretLeft size={14} aria-hidden />
          Anterior
        </button>
        <span className="hidden text-xs text-muted sm:block">También con las flechas del teclado</span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={shown === total - 1}
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[0.8125rem] text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground active:scale-[0.98] disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground-secondary"
        >
          Siguiente
          <CaretRight size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
