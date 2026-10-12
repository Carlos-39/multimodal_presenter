/**
 * Tema claro/oscuro elegido por el usuario. Preferencia de PRESENTACIÓN, local al navegador
 * (`localStorage`); no viaja al backend ni a la telemetría.
 *
 * Sin preferencia guardada se sigue al sistema operativo (ver `color-scheme` en `globals.css`).
 * Al elegir, se fija `data-theme` en <html> y se recuerda.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** Tema efectivo: la preferencia guardada manda; si no hay, el del sistema. */
export function resolveTheme(stored: string | null | undefined, systemPrefersDark: boolean): Theme {
  return parseTheme(stored) ?? (systemPrefersDark ? "dark" : "light");
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Script en línea del <head>: aplica la preferencia guardada antes del primer pintado. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
