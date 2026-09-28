import type { Section } from "@/lib/types";
import { ContentRenderer } from "./ContentRenderer";

/**
 * Render del contenido de una `Section`. Delega en `ContentRenderer` (la Generative UI
 * compartida con el chat), para no duplicar el despacho por `content_type`.
 */
export function SectionRenderer({ section }: { section: Section }) {
  return <ContentRenderer content={section.content} />;
}
