/**
 * Esqueletos de carga: ocupan el lugar y la forma de lo que va a llegar. Son decorativos
 * (`aria-hidden`); el texto de estado que los acompaña es lo que se anuncia a lectores de pantalla.
 */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={`skeleton block h-3 ${className}`} aria-hidden />;
}

/** Párrafo en espera: varias líneas, la última más corta. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span className="block space-y-2.5" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} className={i === lines - 1 ? "w-3/5" : "w-full"} />
      ))}
    </span>
  );
}

/** Tarjeta de sección en espera: misma caja que `SectionCard` (título, cuerpo, cita). */
export function SectionSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6" aria-hidden>
      <SkeletonLine className="mb-5 h-4 w-2/5" />
      <SkeletonText lines={3} />
      <div className="mt-5 border-t border-border pt-3">
        <SkeletonLine className="h-2.5 w-1/2" />
      </div>
    </div>
  );
}
