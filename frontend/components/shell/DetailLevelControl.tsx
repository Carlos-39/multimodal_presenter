/**
 * Selector de nivel de detalle (resumen / detallado).
 *
 * Placeholder del núcleo fijo: su lugar existe ya, pero no tiene función todavía.
 * TODO(Hito5): conectar con la heurística núcleo/satélite para alternar entre modo
 * resumen (solo `core`) y detallado (core + satellite).
 */
export function DetailLevelControl() {
  return (
    <div
      className="flex items-center gap-1 rounded-md border border-border p-0.5 opacity-50"
      aria-label="Nivel de detalle (no disponible aún)"
      title="Disponible en un hito posterior"
    >
      <span className="rounded px-2 py-0.5 text-xs font-medium text-foreground">
        Resumen
      </span>
      <span className="rounded px-2 py-0.5 text-xs text-muted">Detallado</span>
    </div>
  );
}
