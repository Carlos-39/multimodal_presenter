"use client";

import { useEffect } from "react";

/**
 * Teclado para pasar diapositivas (flechas izquierda/derecha y AvPág/RePág). Lo comparten la vista
 * de slides y la presentación generada. No roba teclas cuando no le tocan: al escribir en un
 * campo, si otro control ya usó la tecla, o con una vista ampliada (diálogo) abierta.
 */
export function useSlideKeys(onStep: (delta: 1 | -1) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)) {
        return;
      }
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") onStep(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStep]);
}
