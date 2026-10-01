"use client";

import { useEffect, useState } from "react";
import { CaretLeft, CaretRight, Sparkle } from "@phosphor-icons/react";
import type { GeneratedDeck, GroundingStatus, SourceReference } from "@/lib/types";
import { SourceCitation, UnanchoredNotice } from "./SourceCitation";

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
      {/* Identifica la pieza: es una presentación GENERADA (guion propio), no otra vista del
          contenido. Misma marca de "generado" que las ilustraciones de apoyo. */}
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted">
          <Sparkle size={12} weight="fill" className="shrink-0 translate-y-px text-accent" aria-hidden />
          <span className="font-medium text-foreground">Presentación generada</span>
          <span className="hidden truncate sm:inline">con guion propio a partir de tu documento</span>
        </p>
        <span className="tabular shrink-0 text-xs text-muted">
          {shown + 1} / {total}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* `key` por slide → entra con la animación al cambiar de diapositiva. */}
        <article
          key={shown}
          className="section-enter flex min-h-full flex-col rounded-lg border border-border bg-surface p-8"
        >
          <h2 className="mb-4 text-balance font-serif text-[1.375rem] font-semibold leading-7 tracking-[-0.01em] text-foreground">
            {slide.title}
          </h2>

          {/* No todo es viñetas: `body` es una frase/idea central; los bullets, enumeraciones. */}
          {slide.body ? (
            <p className="mb-4 max-w-[68ch] font-serif text-[1.0625rem] leading-[1.6] text-foreground">
              {slide.body}
            </p>
          ) : null}

          {slide.bullets.length > 0 ? (
            <ul className="max-w-[68ch] space-y-2.5">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 font-serif text-base leading-[1.6] text-foreground">
                  <span className="mt-[0.7em] inline-block h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {slide.illustration ? (
            <figure className="mt-5 overflow-hidden rounded-md border border-dashed border-border-strong bg-background">
              <figcaption className="flex items-center gap-1.5 border-b border-dashed border-border-strong bg-surface-sunken px-3 py-1.5 text-xs font-medium text-muted">
                <Sparkle size={12} weight="fill" aria-hidden />
                {slide.illustration.label}
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.illustration.image_url} alt={slide.illustration.alt} className="block w-full" />
            </figure>
          ) : null}

          <footer className="mt-auto pt-6">
            <div className="border-t border-border pt-3 text-xs">
              {slide.is_synthesis ? (
                <span className="text-muted">Síntesis del documento, sin cita exacta</span>
              ) : slide.source && slide.grounding !== "not_found" ? (
                <SourceCitation onOpen={() => onOpenSource(slide.source!, slide.grounding)}>
                  {truncate(slide.source.quote)}
                </SourceCitation>
              ) : (
                <UnanchoredNotice>No anclada a la fuente</UnanchoredNotice>
              )}
            </div>
          </footer>
        </article>
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

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
