"use client";

import type { ReactNode } from "react";
import { useEnPantalla } from "@/hooks/useEnPantalla";

/**
 * El marco de una figura, y lo que la hace dibujarse al llegar a ella.
 *
 * **Las figuras de este relato se trazan solas cuando entran en pantalla.** No es adorno: casi
 * todas explican un RECORRIDO —qué entra, por dónde pasa, qué sale— y verlo trazarse en orden
 * dice lo que un dibujo quieto solo insinúa. Es el mismo mecanismo que la portada usa para el
 * diagrama de «cómo funciona»: un `IntersectionObserver`, nunca el scroll.
 *
 * Marca `data-visible` en el contenedor, que es lo que dispara `.trazo` y `.revelar` dentro. Una
 * figura que no los use simplemente no se anima, y se ve igual.
 *
 * Con «reducir movimiento» todo aparece ya terminado, nunca a medias ni invisible.
 */
export function Figura({ children, pie }: { children: ReactNode; pie: string }) {
  const { ref, visible } = useEnPantalla<HTMLDivElement>("0px 0px -20% 0px");

  return (
    <figure className="my-2 flex flex-col gap-3">
      <div
        ref={ref}
        data-visible={visible}
        className="overflow-x-auto rounded-lg border border-border bg-surface px-4 py-6"
      >
        {children}
      </div>
      <figcaption className="text-xs leading-5 text-muted">{pie}</figcaption>
    </figure>
  );
}
