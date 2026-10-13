"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

/**
 * Una hoja que sube desde abajo.
 *
 * **Es la respuesta a una sola pregunta, repetida.** En escritorio, lo que no cabe en el contenido
 * vive en columnas: el carril de secciones a la izquierda, la fuente y el chat a la derecha. En un
 * teléfono no hay anchura para ninguna columna, así que todas se convierten en lo mismo — una hoja
 * que sube, tapa lo justo y se va. Una idea repetida vale más que cuatro soluciones distintas, y
 * además se aprende una vez.
 *
 * Sube tapando **tres cuartos** de la pantalla como mucho: que siga viéndose un trozo del documento
 * detrás es lo que dice «esto está encima de aquello» sin tener que explicarlo, y es lo que hace
 * obvio que tocar fuera la cierra.
 *
 * Se cierra de tres maneras —fuera, la equis y Escape— porque en un móvil la gente prueba la que
 * le sale primero, y una hoja de la que no se sabe salir es peor que no tenerla.
 */
interface HojaProps {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
}

export function Hoja({ abierta, onCerrar, titulo, children }: HojaProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierta) return;
    function teclas(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", teclas);
    // El foco entra en la hoja: si se quedara detrás, el lector de pantalla seguiría leyendo el
    // documento mientras el teclado navega por algo que ya no se ve.
    panel.current?.focus();
    return () => document.removeEventListener("keydown", teclas);
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        aria-label={`Cerrar ${titulo}`}
        onClick={onCerrar}
        className="absolute inset-0 w-full cursor-default bg-black/40"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        // Se apoya SOBRE la barra de abajo, no debajo de ella: la barra sigue visible y pulsable
        // con la hoja abierta, así que se salta de «Secciones» a «Generar» en un toque en vez de
        // dos. Y es lo que hace honesto el resaltado de la barra — marcar el destino abierto no
        // sirve de nada si lo que lo marca está tapado.
        className="hoja-sube absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] flex max-h-[75dvh] flex-col rounded-t-2xl border-t border-border bg-surface shadow-float outline-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-1 pt-2.5">
          {/* El tirador no arrastra nada, y aun así gana su sitio: es la señal aprendida de que
              esto es una hoja y no una pantalla nueva. */}
          <span aria-hidden className="absolute inset-x-0 top-2 mx-auto h-1 w-9 rounded-full bg-border-strong" />
          <h2 className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-muted">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label={`Cerrar ${titulo}`}
            className="mt-2 -mr-1 rounded-md p-1 text-muted transition-colors hover:text-foreground"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        {/* El desplazamiento vive AQUÍ y no en la hoja entera: la cabecera con el título y la
            equis tiene que quedarse quieta, o se pierde la salida justo al bajar. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
