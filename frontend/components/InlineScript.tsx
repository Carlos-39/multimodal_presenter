"use client";

/**
 * Script en línea que corre durante el parseo del HTML (antes del primer pintado). En el cliente
 * se renderiza como `text/plain` para que React no lo re-ejecute ni avise en desarrollo; patrón
 * de la guía de Next "preventing flash before hydration".
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
