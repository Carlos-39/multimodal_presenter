"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { oppositeTheme, parseTheme, resolveTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

/**
 * Alterna claro/oscuro (parte del núcleo fijo: vive en el header y no depende del contenido).
 * Sin preferencia guardada sigue al sistema; al pulsar, fija el tema contrario y lo recuerda.
 */
const THEME_EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null; // almacenamiento no disponible → se sigue al sistema
  }
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

function currentTheme(): Theme {
  // El atributo ya aplicado manda (cubre el caso sin almacenamiento); si no, lo guardado/sistema.
  const applied = parseTheme(document.documentElement.getAttribute("data-theme"));
  return applied ?? resolveTheme(readStored(), window.matchMedia(DARK_QUERY).matches);
}

export function ThemeToggle() {
  // SSR-safe: el servidor asume claro; el cliente corrige al hidratar sin error de hidratación.
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => "light");

  // En desarrollo, el remontaje de Strict Mode borra el atributo que puso el script del <head>;
  // se re-aplica antes de pintar. En producción es un no-op.
  useLayoutEffect(() => {
    const stored = parseTheme(readStored());
    if (stored) document.documentElement.setAttribute("data-theme", stored);
  }, []);

  function toggle() {
    const next = oppositeTheme(theme);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // sin almacenamiento: el cambio vale para esta sesión.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const toDark = theme === "light";
  const label = toDark ? "Cambiar a tema oscuro" : "Cambiar a tema claro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
    >
      {toDark ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
    </button>
  );
}
