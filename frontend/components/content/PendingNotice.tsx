import { CircleNotch } from "@phosphor-icons/react/dist/ssr";

/**
 * Aviso flotante de trabajo en segundo plano que va a AÑADIR algo a lo que ya se ve (hoy, las
 * ilustraciones de apoyo, que llegan después del contenido). Se queda pegado al borde inferior
 * del área de lectura, esté donde esté el usuario, y desaparece solo. No bloquea nada.
 */
export function PendingNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none sticky bottom-4 z-10 flex justify-center">
      <p
        role="status"
        className="section-enter flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs text-foreground-secondary shadow-float"
      >
        <CircleNotch size={13} className="shrink-0 animate-spin text-accent" aria-hidden />
        {children}
      </p>
    </div>
  );
}
