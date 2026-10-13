"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  clampPanelWidth,
  PANEL_DEFAULT_WIDTH,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  resolveWorkspace,
  WORKSPACE_WIDE,
  type PanelId,
} from "@/lib/workspace";

/**
 * Coordinador de la Escala 2 (Hito 5e): decide cómo conviven las columnas OPCIONALES
 * (fuente 5c + chat 6) con el contenido, sin tocar el núcleo fijo (header + nav).
 *
 * La decisión (columna | overlay | oculto) es pura y vive en `lib/workspace.ts`; aquí solo se
 * observa el ancho y se pinta. El ancho SOLO cambia el layout al abrir/cerrar un panel o al
 * redimensionar la ventana — nunca al llegar una sección por streaming.
 *
 * Cada columna se puede ensanchar o angostar arrastrando su borde izquierdo (o con las flechas,
 * con el borde enfocado). Los topes viven en `clampPanelWidth`: ni el panel ni el contenido
 * quedan ilegibles. El ancho elegido dura la sesión; doble clic lo devuelve al de partida.
 */

const PANEL_LABEL: Record<PanelId, string> = {
  source: "documento fuente",
  chat: "chat",
};
const KEY_STEP = 24; // px por pulsación de flecha

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

  // Progreso de lectura (Hito 5g): barra fina atada al scroll del contenido. Da sensación de
  // avance en documentos largos sin reabrir el layout del 5e. 0 cuando no hay desplazamiento.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
  }, []);

  // Anchos elegidos por el usuario para cada columna (solo presentación; viven en la sesión).
  const containerRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<Record<PanelId, number>>(PANEL_DEFAULT_WIDTH);
  const [resizing, setResizing] = useState<PanelId | null>(null);
  const dragRef = useRef<{ id: PanelId; startX: number; startWidth: number } | null>(null);

  // Solo se consideran paneles con contenido real (la fuente puede no tener sección activa).
  const panels: { id: PanelId; node: React.ReactNode }[] = [];
  if (source) panels.push({ id: "source", node: source });
  panels.push({ id: "chat", node: chat });

  const columns = panels.filter((p) => layout[p.id] === "column");
  const overlay = panels.find((p) => layout[p.id] === "overlay") ?? null;

  /** Aplica un ancho pedido respetando los topes (el contenido conserva su mínimo). */
  function resize(id: PanelId, desired: number) {
    const total = containerRef.current?.clientWidth ?? width;
    const others = columns
      .filter((c) => c.id !== id)
      .reduce((sum, c) => sum + widths[c.id], 0);
    const next = clampPanelWidth(id, desired, total - others);
    setWidths((prev) => (prev[id] === next ? prev : { ...prev, [id]: next }));
  }

  function onHandlePointerDown(id: PanelId, e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    // Captura: los movimientos siguen llegando aquí aunque el cursor pase sobre el <iframe> del PDF.
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, startX: e.clientX, startWidth: widths[id] };
    setResizing(id);
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    // El borde está a la IZQUIERDA de la columna: arrastrar hacia la izquierda la ensancha.
    resize(drag.id, drag.startWidth + (drag.startX - e.clientX));
  }
  function endDrag() {
    dragRef.current = null;
    setResizing(null);
  }
  function onHandleKeyDown(id: PanelId, e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") resize(id, widths[id] + KEY_STEP);
    else if (e.key === "ArrowRight") resize(id, widths[id] - KEY_STEP);
    else if (e.key === "Home") resize(id, PANEL_DEFAULT_WIDTH[id]);
    else return;
    e.preventDefault();
    e.stopPropagation(); // que las flechas no cambien además de slide
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full ${resizing ? "cursor-col-resize select-none" : ""}`}
    >
      <div ref={scrollRef} onScroll={onScroll} className="relative min-w-0 flex-1 overflow-y-auto">
        {/* Barra de progreso de lectura: sticky al tope del contenido; crece con el scroll. */}
        <div
          className="pointer-events-none sticky top-0 z-10 h-0.5 bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />
        {children}
      </div>

      {columns.map((p) => (
        <div
          key={p.id}
          className="relative shrink-0 border-l border-border bg-surface"
          style={{ width: widths[p.id] }}
        >
          {/* Borde de arrastre: zona de 9px centrada en el borde, con una línea de tinta al
              pasar el cursor, enfocar o arrastrar (indica que el ancho es ajustable). */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={`Ajustar el ancho del ${PANEL_LABEL[p.id]}`}
            aria-valuenow={widths[p.id]}
            aria-valuemin={PANEL_MIN_WIDTH[p.id]}
            aria-valuemax={PANEL_MAX_WIDTH[p.id]}
            tabIndex={0}
            title="Arrastra para ajustar el ancho. Doble clic para restablecer."
            onPointerDown={(e) => onHandlePointerDown(p.id, e)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => resize(p.id, PANEL_DEFAULT_WIDTH[p.id])}
            onKeyDown={(e) => onHandleKeyDown(p.id, e)}
            className="group absolute inset-y-0 -left-[5px] z-10 flex w-[9px] cursor-col-resize touch-none justify-center focus-visible:outline-none"
          >
            <span
              className={`h-full w-0.5 transition-colors group-hover:bg-accent group-focus-visible:bg-accent ${
                resizing === p.id ? "bg-accent" : "bg-transparent"
              }`}
              aria-hidden
            />
          </div>
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
          {/* El tope es «todo menos 44 px» y no «todo»: en un teléfono el panel se comía la
              pantalla entera menos una rendija de 35 px, demasiado estrecha para acertarle con el
              dedo y demasiado ancha para parecer a propósito. 44 px es el mínimo que se puede
              tocar, así que cerrar tocando fuera vuelve a ser una salida de verdad. En una
              pantalla ancha no cambia nada: el panel ya mide mucho menos que eso. */}
          <div
            className="absolute inset-y-0 right-0 z-20 max-w-[calc(100%-2.75rem)] bg-surface shadow-float"
            style={{ width: PANEL_DEFAULT_WIDTH[overlay.id] }}
          >
            {overlay.node}
          </div>
        </>
      ) : null}
    </div>
  );
}
