import type { SummaryStatus } from "@/lib/types";

/**
 * Adelanto inicial del contenido (Hito 5g). Estado transitorio en la zona dinámica, antes/junto
 * a las primeras secciones del streaming (5d). No toca el núcleo fijo. Sigue el principio de
 * honestidad del sistema: si el adelanto falla, se dice, no se oculta.
 */
interface SummaryBannerProps {
  status: SummaryStatus;
  summary: string | null;
}

export function SummaryBanner({ status, summary }: SummaryBannerProps) {
  if (status === "idle") return null;

  return (
    <div className="section-enter mx-auto max-w-3xl px-6">
      <div className="rounded-md border border-border bg-surface/60 px-4 py-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Adelanto</p>
        {status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
            Leyendo el documento…
          </p>
        ) : status === "error" ? (
          <p className="text-sm text-warning">No se pudo generar el adelanto.</p>
        ) : (
          <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        )}
      </div>
    </div>
  );
}
