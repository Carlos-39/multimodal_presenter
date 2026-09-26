import type { Section } from "./types";

/**
 * Nivel de detalle (Punto 11): control explícito del usuario, sin detección automática.
 * - `summary`: solo los núcleos (`core`) — contenido completo y autosuficiente (Punto 9).
 * - `detailed`: núcleos + satélites (profundidad adicional).
 */
export type DetailLevel = "summary" | "detailed";

/**
 * Default: resumen (progressive disclosure, Punto 9). El núcleo se muestra primero, completo;
 * el detalle es una invitación a un clic, no un obstáculo.
 */
export const DEFAULT_DETAIL_LEVEL: DetailLevel = "summary";

/**
 * Secciones visibles según el nivel. En `summary` solo núcleos; si no hubiera ninguno,
 * cae a mostrar todo (nunca una pantalla vacía). NO empobrece el núcleo: solo filtra.
 */
export function visibleSections(sections: Section[], level: DetailLevel): Section[] {
  if (level === "detailed") return sections;
  const cores = sections.filter((s) => s.role === "core");
  return cores.length > 0 ? cores : sections;
}
