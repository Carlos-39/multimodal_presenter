/**
 * Parte un texto en tres tramos para resaltar el rango [start, end): antes, resaltado, después.
 * Puro y determinista (Caso A del Hito 5c). Si no hay offsets válidos, no resalta nada.
 */
export interface HighlightSegments {
  before: string;
  mark: string;
  after: string;
}

export function highlightSegments(
  text: string,
  start: number | null,
  end: number | null,
): HighlightSegments {
  if (start === null || end === null || end <= start) {
    return { before: text, mark: "", after: "" };
  }
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  return { before: text.slice(0, s), mark: text.slice(s, e), after: text.slice(e) };
}
