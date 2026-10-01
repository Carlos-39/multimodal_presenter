import { isAnchored, UNANCHORED_NOTICE } from "@/lib/grounding";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionRenderer } from "./SectionRenderer";

/** Icono de "generada" para la banda de la ilustración de apoyo. */
function GeneratedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5 9.2 5.1 12.8 6.3 9.2 7.5 8 11.1 6.8 7.5 3.2 6.3 6.8 5.1 8 1.5Z" />
      <path d="M12.7 10.2 13.3 12 15.1 12.6 13.3 13.2 12.7 15 12.1 13.2 10.3 12.6 12.1 12 12.7 10.2Z" />
    </svg>
  );
}

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

      {/* Ilustración de apoyo GENERADA (Hito 5h Parte 1). Etiqueta permanente SIEMPRE visible (no
          tooltip), borde punteado y banda propia → imposible confundirla con contenido verificado.
          No tiene fuente ni grounding: es ayuda didáctica declarada. */}
      {section.illustration ? (
        <figure className="mt-3 overflow-hidden rounded-md border border-dashed border-muted/60 bg-background">
          <figcaption className="flex items-center gap-1.5 border-b border-dashed border-muted/60 bg-muted/10 px-3 py-1.5 text-xs font-medium text-muted">
            <GeneratedIcon />
            <span>{section.illustration.label}</span>
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={section.illustration.image_url} alt={section.illustration.alt} className="block w-full" />
        </figure>
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
