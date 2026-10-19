/**
 * Escala 2 del layout compositivo (Hito 5e): reglas de COLUMNAS opcionales en pantalla.
 *
 * El núcleo fijo (header + nav) nunca compite por espacio, está fuera de esta lógica. Aquí
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
 * por streaming: por eso el streaming no dispara recálculo de columnas.
 *
 * NOTA sobre la Escala 1 (composición INTERNA de una sección con varios content_type): es **spec
 * documentada, no cableada**. El contrato define `Section.content` como UN solo bloque, así que
 * una sección no combina tipos hoy; las reglas internas (chart > table > timeline > text) se
 * activarían solo si el contrato admitiera secciones multi-contenido. Ver Registro (Hito 5e/5f).
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

// ── Ancho ajustable de las columnas opcionales ──
//
// El usuario puede ensanchar o angostar cada columna arrastrando su borde. NO cambia la regla de
// emplazamiento de arriba (columna | overlay | oculto): solo el ancho de una columna ya visible, y
// siempre dentro de topes para que ni el panel ni el contenido queden ilegibles.

export const PANEL_DEFAULT_WIDTH: Record<PanelId, number> = { source: 416, chat: 320 };
export const PANEL_MIN_WIDTH: Record<PanelId, number> = { source: 320, chat: 280 };
export const PANEL_MAX_WIDTH: Record<PanelId, number> = { source: 720, chat: 520 };
/** Ancho mínimo que debe conservar el contenido cuando hay columnas abiertas. */
export const CONTENT_MIN_WIDTH = 420;

/**
 * Ajusta el ancho pedido de una columna a sus topes.
 *
 * @param id        panel que se redimensiona.
 * @param desired   ancho pedido en px.
 * @param available px que quedan para ESTE panel + el contenido (ancho del área de trabajo menos
 *                  las demás columnas visibles).
 */
export function clampPanelWidth(id: PanelId, desired: number, available: number): number {
  const max = Math.min(PANEL_MAX_WIDTH[id], available - CONTENT_MIN_WIDTH);
  // Si no cabe ni el mínimo respetando el contenido, gana el mínimo del panel (sigue siendo usable).
  return Math.round(Math.max(PANEL_MIN_WIDTH[id], Math.min(desired, max)));
}
