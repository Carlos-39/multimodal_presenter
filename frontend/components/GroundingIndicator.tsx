import type { GroundingReport } from "@/lib/types";

/**
 * Indicador discreto del estado de grounding (atribución de fuentes).
 *
 * Distingue el tipo de fuente honestamente:
 * - Texto: "N/total ancladas"; ámbar si hay citas no encontradas (warning real).
 * - PDF/imagen/audio: la verificación de contenido no aplica (no se aplana la fuente) → se
 *   muestra neutro, no como fallo. Lo que SÍ varía entre ellos es a qué ancla cada uno, y el
 *   tooltip lo dice: el PDF a una página, el audio a un momento, la imagen a sí misma. Decir
 *   "por página" para un audio (que no tiene páginas) era simplemente incorrecto.
 *   TODO(Hito5): verificación por página/región + resaltado interactivo sobre el documento.
 */
interface GroundingIndicatorProps {
  grounding: GroundingReport | null;
}

export function GroundingIndicator({ grounding }: GroundingIndicatorProps) {
  if (!grounding || grounding.total_sections === 0) return null;

  if (grounding.source_kind !== "text") {
    const ancla =
      grounding.source_kind === "pdf"
        ? "atribución por página"
        : grounding.source_kind === "audio"
          ? "atribución por momento del audio"
          : "atribución a la imagen completa";
    return (
      <div
        className="hidden items-center gap-1.5 text-xs text-muted sm:flex"
        title={`Fuente no textual: ${ancla}; la verificación del contenido no aplica (no se aplana la fuente)`}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-muted" aria-hidden />
        <span>
          <span className="tabular">{grounding.total_sections}</span> secciones, anclaje pendiente
        </span>
      </div>
    );
  }

  const hasWarnings = grounding.not_found_sections > 0;
  return (
    <div
      className="hidden items-center gap-1.5 text-xs sm:flex"
      title={
        hasWarnings
          ? `${grounding.not_found_sections} cita(s) no encontrada(s) en el documento`
          : "Todas las secciones están ancladas a su fuente"
      }
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          hasWarnings ? "bg-warning" : "bg-verified"
        }`}
        aria-hidden
      />
      <span className={hasWarnings ? "text-warning" : "text-foreground-secondary"}>
        <span className="tabular">
          {grounding.verified_sections}/{grounding.total_sections}
        </span>{" "}
        ancladas
      </span>
    </div>
  );
}
