"use client";

import { useSyncExternalStore } from "react";
import { resolveWorkspace, WORKSPACE_WIDE, type PanelId } from "@/lib/workspace";

/**
 * Coordinador de la Escala 2 (Hito 5e): decide cómo conviven las columnas OPCIONALES
 * (fuente 5c + chat 6) con el contenido, sin tocar el núcleo fijo (header + nav).
 *
 * La decisión (columna | overlay | oculto) es pura y vive en `lib/workspace.ts`; aquí solo se
 * observa el ancho y se pinta. El ancho SOLO cambia el layout al abrir/cerrar un panel o al
 * redimensionar la ventana — nunca al llegar una sección por streaming.
 */

// Ancho de cada columna opcional. Literales para que Tailwind los genere.
const PANEL_WIDTH: Record<PanelId, string> = {
  source: "w-[26rem]",
  chat: "w-80",
};

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** Ancho del viewport, SSR-safe: en el servidor asume amplio (desktop-first, sin parpadeo a overlay). */
function useViewportWidth(): number {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => WORKSPACE_WIDE,
  );
}

interface WorkspaceProps {
  children: React.ReactNode; // contenido (siempre presente)
  source: React.ReactNode | null; // panel de fuente, o null si no hay sección activa
  chat: React.ReactNode; // panel de chat (placeholder hasta Hito 6)
  openOrder: PanelId[]; // paneles abiertos, el más reciente al final
  onClosePanel: (id: PanelId) => void;
}

export function Workspace({ children, source, chat, openOrder, onClosePanel }: WorkspaceProps) {
  const width = useViewportWidth();
  const layout = resolveWorkspace(openOrder, width);

  // Solo se consideran paneles con contenido real (la fuente puede no tener sección activa).
  const panels: { id: PanelId; node: React.ReactNode }[] = [];
  if (source) panels.push({ id: "source", node: source });
  panels.push({ id: "chat", node: chat });

  const columns = panels.filter((p) => layout[p.id] === "column");
  const overlay = panels.find((p) => layout[p.id] === "overlay") ?? null;

  return (
    <div className="relative flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>

      {columns.map((p) => (
        <div
          key={p.id}
          className={`${PANEL_WIDTH[p.id]} shrink-0 border-l border-border bg-surface`}
        >
          {p.node}
        </div>
      ))}

      {overlay ? (
        <>
          <button
            type="button"
            aria-label="Cerrar panel"
            onClick={() => onClosePanel(overlay.id)}
            className="absolute inset-0 z-10 bg-black/40"
          />
          <div
            className={`absolute inset-y-0 right-0 z-20 ${PANEL_WIDTH[overlay.id]} max-w-full border-l border-border bg-surface shadow-xl`}
          >
            {overlay.node}
          </div>
        </>
      ) : null}
    </div>
  );
}
