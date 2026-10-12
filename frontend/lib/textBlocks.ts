/**
 * Parte el texto de una sección en bloques para mostrarlo: párrafos y, cuando el texto trae una
 * enumeración escrita con guiones o números, listas. Solo presentación: no cambia ni reordena
 * el contenido, y ante la duda lo deja como párrafo.
 */
export type TextBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const BULLET = /^[-•*–]\s+(.+)$/;
const NUMBERED = /^\d+[.)]\s+(.+)$/;

function asList(lines: string[]): TextBlock | null {
  // Una lista necesita al menos dos ítems y que TODAS las líneas lo sean (si no, es prosa).
  if (lines.length < 2) return null;
  for (const [pattern, ordered] of [
    [BULLET, false],
    [NUMBERED, true],
  ] as const) {
    const items = lines.map((line) => pattern.exec(line)?.[1]);
    if (items.every((item): item is string => item !== undefined)) {
      return { kind: "list", ordered, items };
    }
  }
  return null;
}

export function parseTextBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) continue;

    const list = asList(lines);
    if (list) {
      blocks.push(list);
      continue;
    }
    // Frase introductoria seguida de su lista ("Se midió:\n- A\n- B").
    const tail = asList(lines.slice(1));
    if (tail && !BULLET.test(lines[0]) && !NUMBERED.test(lines[0])) {
      blocks.push({ kind: "paragraph", text: lines[0] }, tail);
      continue;
    }
    blocks.push({ kind: "paragraph", text: lines.join(" ") });
  }
  return blocks;
}
