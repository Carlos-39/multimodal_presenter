import type { Section } from "@/lib/types";
import { ChartSection } from "./ChartSection";
import { TableSection } from "./TableSection";
import { TextSection } from "./TextSection";
import { TimelineSection } from "./TimelineSection";

/**
 * Despacho determinista por tipo de contenido (mismo discriminador que el backend).
 * El `switch` es exhaustivo: si el contrato añade un content_type, TypeScript avisa.
 */
export function SectionRenderer({ section }: { section: Section }) {
  const content = section.content;
  switch (content.content_type) {
    case "text":
      return <TextSection content={content} />;
    case "table":
      return <TableSection content={content} />;
    case "timeline":
      return <TimelineSection content={content} />;
    case "chart":
      return <ChartSection content={content} />;
    default: {
      const _exhaustive: never = content;
      return <>{_exhaustive}</>;
    }
  }
}
