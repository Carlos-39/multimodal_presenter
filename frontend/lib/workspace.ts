/**
 * Escala 2 del layout compositivo (Hito 5e): reglas de COLUMNAS opcionales en pantalla.
 *
 * El núcleo fijo (header + nav) nunca compite por espacio — está fuera de esta lógica. Aquí
 * solo se arbitran los dos paneles OPCIONALES (fuente 5c y chat 6): dónde va cada uno según
 * cuáles pidió abrir el usuario y el ancho de viewport.
 *
 * Regla (desktop-first, coexistencia estilo NotebookLM con salvaguarda de ancho):
 * - `>= WIDE`: los paneles abiertos **coexisten** como columnas (hay sitio sin aplastar el
 *   contenido).
 * - `[MID, WIDE)`: cabe **una** columna → se muestra el panel abierto más reciente; el otro
 *   queda oculto (sigue "abierto" en estado y reaparece al ensanchar la ventana).
 * - `< MID`: no caben columnas → el más reciente se muestra como **overlay** (drawer sobre el
 *   contenido), uno a la vez.
 *
 * Es determinista y depende SOLO de (paneles abiertos, ancho); no de cuántas secciones llegaron
 * por streaming — por eso el streaming no dispara recálculo de columnas.
 */

export type PanelId = "source" | "chat";
export type PanelPlacement = "column" | "overlay" | "hidden";

export interface WorkspaceLayout {
  source: PanelPlacement;
  chat: PanelPlacement;
}

// Breakpoints (px). Elegidos para que el contenido conserve un ancho legible antes de admitir
// cada columna: MID ≈ nav + contenido + 1 panel; WIDE ≈ nav + contenido + 2 paneles.
export const WORKSPACE_MID = 1024;
export const WORKSPACE_WIDE = 1280;

/**
 * Decide el emplazamiento de cada panel opcional.
 *
 * @param openOrder paneles abiertos en orden de apertura (el más reciente al final).
 * @param width     ancho del viewport en px.
 */
export function resolveWorkspace(openOrder: PanelId[], width: number): WorkspaceLayout {
  const layout: WorkspaceLayout = { source: "hidden", chat: "hidden" };

  // Dedup conservando la aparición MÁS reciente (un id repetido se mueve al final).
  const open: PanelId[] = [];
  for (const id of openOrder) {
    const existing = open.indexOf(id);
    if (existing !== -1) open.splice(existing, 1);
    open.push(id);
  }
  if (open.length === 0) return layout;

  const mostRecent = open[open.length - 1];

  if (width >= WORKSPACE_WIDE) {
    for (const id of open) layout[id] = "column"; // coexistencia
  } else if (width >= WORKSPACE_MID) {
    layout[mostRecent] = "column"; // una sola columna: la más reciente
  } else {
    layout[mostRecent] = "overlay"; // angosto → overlay, uno a la vez
  }
  return layout;
}
