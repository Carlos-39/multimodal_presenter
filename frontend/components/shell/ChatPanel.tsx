/**
 * Estructura del chat anclado a fuentes (parte del núcleo fijo, Punto 8).
 *
 * Placeholder: la caja de input y la forma del historial existen como armazón; el
 * comportamiento real (respuestas ancladas, preguntas sugeridas) llega después.
 * TODO(Hito6): componente conversacional con anclaje obligatorio a fuente y
 * preguntas sugeridas contextuales.
 */
export function ChatPanel() {
  return (
    <div className="flex h-full flex-col">
      <h2 className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Chat
      </h2>

      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-center text-sm text-muted">
          El chat anclado a fuentes se habilita en un hito posterior.
        </p>
      </div>

      <div className="border-t border-border p-3">
        <div
          className="rounded-md border border-border px-3 py-2 text-sm text-muted opacity-50"
          title="Disponible en un hito posterior"
        >
          Escribe una pregunta…
        </div>
      </div>
    </div>
  );
}
