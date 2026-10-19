"use client";

import { useRef } from "react";
import { ArrowsOut, Sparkle, X } from "@phosphor-icons/react";
import type { GeneratedIllustration } from "@/lib/types";

/**
 * Ilustración de apoyo GENERADA (Hito 5h Parte 1). Pieza única para las secciones y para la
 * presentación generada, así el trato es idéntico en ambas.
 *
 * Honestidad primero: etiqueta permanente SIEMPRE visible (no tooltip), borde punteado y banda
 * propia → imposible confundirla con contenido verificado. No tiene fuente ni grounding. La
 * etiqueta acompaña también a la vista ampliada.
 *
 * Presentación: la imagen va sobre un marco color papel (igual en claro y en oscuro: se generan
 * con fondo claro y en oscuro un recuadro blanco deslumbraría), con altura acotada para que no
 * pese más que el contenido verificado. Un clic la amplía.
 */
interface GeneratedFigureProps {
  illustration: GeneratedIllustration;
  className?: string;
  /** Alto máximo de la imagen dentro de su contenedor (clase de Tailwind). */
  maxHeightClass?: string;
}

export function GeneratedFigure({
  illustration,
  className = "",
  maxHeightClass = "max-h-80",
}: GeneratedFigureProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <figure
      className={`section-enter overflow-hidden rounded-md border border-dashed border-border-strong ${className}`}
    >
      <figcaption className="flex items-center gap-1.5 border-b border-dashed border-border-strong bg-surface-sunken px-3 py-1.5 text-xs font-medium text-muted">
        <Sparkle size={12} weight="fill" className="shrink-0" aria-hidden />
        <span>{illustration.label}</span>
      </figcaption>

      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label="Ampliar la ilustración"
        className="group relative flex w-full cursor-zoom-in justify-center bg-[var(--paper)] p-3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={illustration.image_url}
          alt={illustration.alt}
          className={`block w-auto max-w-full object-contain ${maxHeightClass}`}
        />
        <span
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--paper)] text-[#46423b] opacity-0 shadow-float transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <ArrowsOut size={15} />
        </span>
      </button>

      {/* La clave de lectura: qué mirar.
          Va FUERA de la imagen y no dentro, y esa es toda la idea. Las ilustraciones se generan
          sin una sola palabra porque los modelos de imagen escriben con faltas (y una figura con
          marcas y sin leyenda deja peor a quien no conoce el tema). Pero esa prohibición era
          sobre el interior del dibujo: aquí el texto lo pone la aplicación, así que está bien
          escrito, se puede leer en voz alta y se busca con Ctrl+F.
          Sobre el papel y no sobre el fondo de la aplicación, para que se lea como el pie de una
          figura y no como contenido del documento, que es lo que no es. */}
      {illustration.clave ? (
        <p className="border-t border-dashed border-border-strong bg-[var(--paper)] px-3 pb-2.5 pt-2 text-xs leading-5 text-[#46423b]">
          {illustration.clave}
        </p>
      ) : null}

      {/* Vista ampliada: <dialog> nativo (foco atrapado, Esc cierra). Clic fuera de la imagen cierra. */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[92vh] max-w-[92vw] overflow-hidden rounded-lg border border-border bg-surface p-0 text-foreground shadow-float backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-3 border-b border-dashed border-border-strong bg-surface-sunken py-1.5 pl-3 pr-1.5 text-xs font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <Sparkle size={12} weight="fill" className="shrink-0" aria-hidden />
            {illustration.label}
          </span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Cerrar la vista ampliada"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface hover:text-foreground"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="bg-[var(--paper)] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={illustration.image_url}
            alt={illustration.alt}
            className="block max-h-[78vh] w-auto max-w-full object-contain"
          />
          {/* La clave acompaña también a la vista ampliada: es justo cuando alguien se para a
              mirar el dibujo de cerca cuando más falta hace saber qué está mirando. */}
          {illustration.clave ? (
            <p className="mx-auto mt-3 max-w-[60ch] text-xs leading-5 text-[#46423b]">
              {illustration.clave}
            </p>
          ) : null}
        </div>
      </dialog>
    </figure>
  );
}
