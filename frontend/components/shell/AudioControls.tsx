/**
 * Controles de reproducción de audio (parte del núcleo fijo, Punto 8).
 *
 * Placeholder: el lugar reservado existe; la función llega después.
 * TODO(Hito5): reproducción de la narración (play/pausa/retroceder) con el principio
 * de modalidad (audio para explicaciones, texto para anclajes).
 */
export function AudioControls() {
  return (
    <div className="p-3">
      <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Audio
      </h2>
      <div className="flex items-center gap-2 opacity-50" title="Disponible en un hito posterior">
        <div className="h-8 w-8 rounded-full border border-border" />
        <div className="h-1.5 flex-1 rounded-full bg-border" />
      </div>
    </div>
  );
}
