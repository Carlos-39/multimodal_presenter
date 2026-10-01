import { isAnchored, UNANCHORED_NOTICE } from "@/lib/grounding";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionRenderer } from "./SectionRenderer";

/**
 * Tarjeta de UNA sección: cabecera (núcleo/satélite) + contenido (Generative UI) + notas +
 * atribución de fuente. Fuente ÚNICA de este render: la comparten la vista de scroll
 * (`ContentArea`) y la vista de slides (Hito 5h Parte 2), para que la trazabilidad y el aspecto
 * sean idénticos entre ambas — una slide no es contenido nuevo, es el mismo contenido re-compuesto.
 */
interface SectionCardProps {
  section: Section;
  index: number;
  chartNotes?: ChartNote[];
  observations?: SemanticObservation[];
  groundingBySection?: Record<string, GroundingStatus>;
  onOpenSource?: (section: Section) => void;
  activeSourceKey?: string | null;
  active?: boolean; // resalte de la sección activa (vista de scroll)
  anchorId?: boolean; // poner id=section-<id> para el scroll-into-view (solo scroll)
}

export function SectionCard({
  section,
  index,
  chartNotes = [],
  observations = [],
  groundingBySection = {},
  onOpenSource,
  activeSourceKey = null,
  active = false,
  anchorId = false,
}: SectionCardProps) {
  const degraded = chartNotes.find((n) => n.section_id === section.id && n.kind === "degraded");
  const observation = observations.find((o) => o.section_id === section.id);
  const isSatellite = section.role === "satellite";
  const status = groundingBySection[section.id] ?? "unverified";
  const anchored = isAnchored(status);

  return (
    <section
      id={anchorId ? `section-${section.id}` : undefined}
      className={`section-enter scroll-mt-4 rounded-md border bg-surface p-5 ${
        active ? "border-accent" : "border-border"
      } ${isSatellite ? "border-l-2 border-l-muted" : ""}`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className={`text-base font-medium ${isSatellite ? "text-muted" : "text-foreground"}`}>
          {section.title ?? `Sección ${index + 1}`}
        </h2>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted">
          {isSatellite ? "satélite · detalle" : "núcleo"}
        </span>
      </header>

      <SectionRenderer section={section} />

      {degraded ? <p className="mt-3 text-xs text-muted">{degraded.detail}</p> : null}

      {observation ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
          <span
            className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-warning"
            aria-hidden
          />
          <span>Posible discrepancia con la fuente: {observation.issue}</span>
        </p>
      ) : null}

      <footer className="mt-4 border-t border-border pt-2">
        {anchored ? (
          <button
            type="button"
            onClick={() => onOpenSource?.(section)}
            className={`text-left text-xs underline-offset-2 transition-colors hover:text-foreground hover:underline ${
              section.id === activeSourceKey ? "text-foreground underline" : "text-muted"
            }`}
          >
            Fuente: “{section.source.quote}” · ver en el documento
          </button>
        ) : (
          // not_found (Hito 8): NO se ofrece "ver fuente" (sería fingir una cita que no ancla);
          // aviso honesto, como el chat. No se descarta la sección.
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <span
              className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-warning"
              aria-hidden
            />
            <span>{UNANCHORED_NOTICE}</span>
          </p>
        )}
      </footer>
    </section>
  );
}
