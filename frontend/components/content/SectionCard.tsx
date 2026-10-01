import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { isAnchored, UNANCHORED_NOTICE } from "@/lib/grounding";
import type { ChartNote, GroundingStatus, Section, SemanticObservation } from "@/lib/types";
import { SectionRenderer } from "./SectionRenderer";
import { SourceCitation, UnanchoredNotice } from "./SourceCitation";

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
      // Núcleo: hoja de papel sobre la mesa. Satélite: sin papel (queda al nivel de la mesa) y con
      // título más liviano → se lee como profundidad adicional, no como otra pieza principal.
      className={`section-enter scroll-mt-4 rounded-lg border p-6 ${
        active ? "border-accent" : "border-border"
      } ${isSatellite ? "bg-transparent" : "bg-surface"}`}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          className={`text-balance font-serif font-semibold ${
            isSatellite
              ? "text-base leading-6 text-foreground-secondary"
              : "text-lg leading-[1.625rem] text-foreground"
          }`}
        >
          {section.title ?? `Sección ${index + 1}`}
        </h2>
        <span className="shrink-0 text-xs text-muted">{isSatellite ? "detalle" : "núcleo"}</span>
      </header>

      <SectionRenderer section={section} />

      {degraded ? <p className="mt-3 text-xs text-muted">{degraded.detail}</p> : null}

      {observation ? (
        <div className="mt-3">
          <UnanchoredNotice>Posible discrepancia con la fuente: {observation.issue}</UnanchoredNotice>
        </div>
      ) : null}

      {/* Ilustración de apoyo GENERADA (Hito 5h Parte 1). Etiqueta permanente SIEMPRE visible (no
          tooltip), borde punteado y banda propia → imposible confundirla con contenido verificado.
          No tiene fuente ni grounding: es ayuda didáctica declarada. */}
      {section.illustration ? (
        <figure className="mt-4 overflow-hidden rounded-md border border-dashed border-border-strong bg-background">
          <figcaption className="flex items-center gap-1.5 border-b border-dashed border-border-strong bg-surface-sunken px-3 py-1.5 text-xs font-medium text-muted">
            <Sparkle size={12} weight="fill" aria-hidden />
            <span>{section.illustration.label}</span>
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={section.illustration.image_url} alt={section.illustration.alt} className="block w-full" />
        </figure>
      ) : null}

      <footer className="mt-5 border-t border-border pt-3">
        {anchored ? (
          <SourceCitation
            onOpen={() => onOpenSource?.(section)}
            active={section.id === activeSourceKey}
          >
            {section.source.quote}
          </SourceCitation>
        ) : (
          // not_found (Hito 8): NO se ofrece "ver fuente" (sería fingir una cita que no ancla);
          // aviso honesto, como el chat. No se descarta la sección.
          <UnanchoredNotice>{UNANCHORED_NOTICE}</UnanchoredNotice>
        )}
      </footer>
    </section>
  );
}
