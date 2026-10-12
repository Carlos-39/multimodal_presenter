import type { SummaryStatus } from "@/lib/types";
import { SkeletonText } from "./Skeleton";

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
    <div className="section-enter mx-auto max-w-3xl px-6 pb-8">
      <div className="rounded-lg bg-surface-sunken px-5 py-4">
        <p className="mb-1 text-xs font-medium text-muted">Adelanto del documento</p>
        {status === "loading" ? (
          <div role="status">
            <span className="sr-only">Leyendo el documento…</span>
            <SkeletonText lines={2} />
          </div>
        ) : status === "error" ? (
          <p className="text-sm text-warning">No se pudo generar el adelanto.</p>
        ) : (
          <p className="max-w-[68ch] font-serif text-base leading-[1.6] text-foreground">{summary}</p>
        )}
      </div>
    </div>
  );
}
