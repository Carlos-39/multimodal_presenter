"use client";

import { useCallback, useId, useState, useSyncExternalStore } from "react";
import { CornersIn, CornersOut, Sparkle } from "@phosphor-icons/react";
import { useSlideKeys } from "@/hooks/useSlideKeys";
import { slideLayout } from "@/lib/deckLayout";
import type { GeneratedDeck, GroundingStatus, SourceReference } from "@/lib/types";
import { GeneratedFigure } from "./GeneratedFigure";
import { SlideNav } from "./SlideNav";
import { SourceCitation, UnanchoredNotice } from "./SourceCitation";

/**
 * Presentación GENERADA en diapositivas (guion propio, desde la fuente). Pieza nueva y separada de
 * la vista de slides del 5h (re-composición sin generación). Trazabilidad por slide (mix honesto):
 * anclada a la fuente ("ver en el documento"), o marcada como síntesis si es una simplificación
 * declarada. Las imágenes de apoyo llevan su etiqueta obligatoria.
 *
 * Cada diapositiva se dibuja sobre un lienzo 16:9 cuya tipografía escala con su ancho (unidades de
 * contenedor en `globals.css`), así se ve igual en la app y proyectada a pantalla completa. La
 * composición la decide `slideLayout` según lo que la slide trae. Si el contenido no cupiera, el
 * lienzo se desplaza por dentro: nunca se recorta.
 */
interface DeckViewProps {
  deck: GeneratedDeck;
  onOpenSource: (source: SourceReference, status: GroundingStatus) => void;
  initialIndex?: number; // diapositiva en la que se abre (0-based)
}

function subscribeFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

export function DeckView({ deck, onOpenSource, initialIndex = 0 }: DeckViewProps) {
  const [index, setIndex] = useState(initialIndex);
  const total = deck.slides.length;
  const shown = total > 0 ? Math.min(index, total - 1) : 0;

  const rootId = useId();
  // Pantalla completa (API del navegador). SSR-safe; donde no existe, el botón no aparece.
  const canFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement?.id === rootId,
    () => false,
  );

  const goTo = useCallback(
    (i: number) => setIndex(Math.max(0, Math.min(total - 1, i))),
    [total],
  );
  const step = useCallback(
    (delta: 1 | -1) => setIndex((i) => Math.max(0, Math.min(total - 1, Math.min(i, total - 1) + delta))),
    [total],
  );
  useSlideKeys(step);

  if (total === 0) return null;
  const slide = deck.slides[shown];
  const layout = slideLayout(slide);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      // Puede rechazarse (permisos del navegador): la presentación sigue usable en la vista normal.
      void document.getElementById(rootId)?.requestFullscreen().catch(() => {});
    }
  }

  // El panel de fuente vive fuera de la pantalla completa: se sale primero para poder verlo.
  function openSource(source: SourceReference, status: GroundingStatus) {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onOpenSource(source, status);
  }

  return (
    <div
      id={rootId}
      className={`mx-auto flex h-full flex-col bg-background ${
        isFullscreen ? "max-w-none px-8 py-6" : "max-w-5xl px-6 py-5"
      }`}
    >
      {/* Identifica la pieza: es una presentación GENERADA (guion propio), no otra vista del
          contenido. Misma marca de "generado" que las ilustraciones de apoyo. */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted">
          <Sparkle size={12} weight="fill" className="shrink-0 translate-y-px text-accent" aria-hidden />
          <span className="shrink-0 font-medium text-foreground">Presentación generada</span>
          <span className="hidden truncate sm:inline">con guion propio a partir de tu documento</span>
        </p>
        {canFullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground"
          >
            {isFullscreen ? <CornersIn size={14} aria-hidden /> : <CornersOut size={14} aria-hidden />}
            {isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          </button>
        ) : null}
      </div>

      <div className="slide-frame flex min-h-0 flex-1 items-center justify-center">
        {/* `key` por slide → entra con la animación al cambiar de diapositiva. */}
        <article
          key={shown}
          className="slide-stage section-enter overflow-hidden rounded-lg border border-border bg-surface"
          aria-roledescription="diapositiva"
          aria-label={`Diapositiva ${shown + 1} de ${total}: ${slide.title}`}
        >
          <div className="slide-pad flex h-full flex-col overflow-y-auto">
            <div
              className={`min-h-0 flex-1 ${
                layout === "media"
                  ? "slide-media"
                  : layout === "statement"
                    ? "flex flex-col justify-center"
                    : ""
              }`}
            >
              <div className="min-w-0">
                <h2 className="slide-title text-balance font-serif font-semibold text-foreground">
                  {slide.title}
                </h2>

                {/* No todo es viñetas: `body` es una frase/idea central; los bullets, enumeraciones. */}
                {slide.body ? (
                  <p
                    className={`font-serif ${
                      layout === "statement"
                        ? "slide-statement text-foreground-secondary"
                        : "slide-body text-foreground"
                    }`}
                  >
                    {slide.body}
                  </p>
                ) : null}

                {slide.bullets.length > 0 ? (
                  <ul className="slide-bullets font-serif text-foreground">
                    {slide.bullets.map((b, i) => (
                      <li key={i} className="flex items-baseline gap-[0.7em]">
                        <span
                          className="inline-block h-[0.3em] w-[0.3em] shrink-0 -translate-y-[0.2em] rounded-full bg-accent"
                          aria-hidden
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {slide.illustration ? (
                <GeneratedFigure
                  illustration={slide.illustration}
                  className="min-w-0"
                  maxHeightClass="slide-figure"
                />
              ) : null}
            </div>

            <footer className="slide-footer shrink-0 border-t border-border text-xs">
              {slide.is_synthesis ? (
                <span className="text-muted">Síntesis del documento, sin cita exacta</span>
              ) : slide.source && slide.grounding !== "not_found" ? (
                <SourceCitation onOpen={() => openSource(slide.source!, slide.grounding)}>
                  {truncate(slide.source.quote)}
                </SourceCitation>
              ) : (
                <UnanchoredNotice>No anclada a la fuente</UnanchoredNotice>
              )}
            </footer>
          </div>
        </article>
      </div>

      <div className="mt-4">
        <SlideNav index={shown} total={total} onGo={goTo} />
      </div>
    </div>
  );
}

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
