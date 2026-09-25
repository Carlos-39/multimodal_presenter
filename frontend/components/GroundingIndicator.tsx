import type { GroundingReport } from "@/lib/types";

/**
 * Indicador discreto del estado de grounding (atribución de fuentes).
 *
 * En este hito solo informa; el uso pleno (resaltado interactivo sobre el documento)
 * es Hito 5. Si hay secciones sin anclar, lo señala de forma no intrusiva.
 * TODO(Hito5): atribución interactiva — clic en una afirmación → fragmento resaltado.
 */
interface GroundingIndicatorProps {
  grounding: GroundingReport | null;
}

export function GroundingIndicator({ grounding }: GroundingIndicatorProps) {
  if (!grounding || grounding.total_sections === 0) return null;

  const hasWarnings = grounding.ungrounded_sections > 0;

  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      title={
        hasWarnings
          ? `${grounding.ungrounded_sections} sección(es) sin anclar a fuente verificada`
          : "Todas las secciones están ancladas a su fuente"
      }
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          hasWarnings ? "bg-warning" : "bg-emerald-600"
        }`}
        aria-hidden
      />
      <span className={hasWarnings ? "text-warning" : "text-muted"}>
        {grounding.grounded_sections}/{grounding.total_sections} ancladas
      </span>
    </div>
  );
}
