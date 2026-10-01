"use client";

import { useEffect, useState } from "react";
import type { GeneratedDeck, GroundingStatus, SourceReference } from "@/lib/types";

/**
 * Presentación GENERADA en diapositivas (guion propio, desde la fuente). Pieza nueva y separada de
 * la vista de slides del 5h (re-composición sin generación). Usa los tokens del 5a. Trazabilidad
 * por slide (mix honesto): anclada a la fuente ("ver fuente"), o marcada como "Síntesis" si es una
 * simplificación declarada. Las imágenes de apoyo llevan su etiqueta obligatoria.
 */
interface DeckViewProps {
  deck: GeneratedDeck;
  onOpenSource: (source: SourceReference, status: GroundingStatus) => void;
}

export function DeckView({ deck, onOpenSource }: DeckViewProps) {
  const [index, setIndex] = useState(0);
  const total = deck.slides.length;
  const shown = total > 0 ? Math.min(index, total - 1) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && /INPUT|TEXTAREA/.test(el.tagName)) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(total - 1, Math.min(i, total - 1) + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, Math.min(i, total - 1) - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  if (total === 0) return null;
  const slide = deck.slides[shown];
  const go = (d: number) => setIndex(Math.max(0, Math.min(total - 1, shown + d)));

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Presentación generada
        </span>
        <span className="tabular shrink-0 text-xs text-muted">
          {shown + 1} / {total}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* `key` por slide → entra con la animación al cambiar de diapositiva. */}
        <article
          key={shown}
          className="section-enter flex min-h-full flex-col rounded-md border border-border bg-surface p-6"
        >
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-foreground">
            {slide.title}
          </h2>

          <ul className="space-y-2">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {slide.illustration ? (
            <figure className="mt-5 overflow-hidden rounded-md border border-dashed border-muted/60 bg-background">
              <figcaption className="border-b border-dashed border-muted/60 bg-muted/10 px-3 py-1.5 text-xs font-medium text-muted">
                {slide.illustration.label}
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.illustration.image_url} alt={slide.illustration.alt} className="block w-full" />
            </figure>
          ) : null}

          <footer className="mt-auto border-t border-border pt-3 text-xs">
            {slide.is_synthesis ? (
              <span className="text-muted">Síntesis del documento (sin cita exacta)</span>
            ) : slide.source && slide.grounding !== "not_found" ? (
              <button
                type="button"
                onClick={() => onOpenSource(slide.source!, slide.grounding)}
                className="text-left text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Fuente: “{truncate(slide.source.quote)}” · ver en el documento
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-warning">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                No anclada a la fuente
              </span>
            )}
          </footer>
        </article>
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

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
