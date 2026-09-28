import type { SectionContent } from "@/lib/types";
import { ChartSection } from "./ChartSection";
import { TableSection } from "./TableSection";
import { TextSection } from "./TextSection";
import { TimelineSection } from "./TimelineSection";

/**
 * Render determinista de UN bloque de contenido por su `content_type` (la discriminated union
 * del contrato, Hito 1). Fuente ÚNICA de la Generative UI: la usa tanto la transformación
 * (`SectionRenderer`) como el chat (Hito 6), para que no existan dos sistemas de render.
 * El `switch` es exhaustivo: si el contrato añade un content_type, TypeScript avisa.
 */
export function ContentRenderer({ content }: { content: SectionContent }) {
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
