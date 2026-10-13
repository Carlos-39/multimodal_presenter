"use client";

import { UserCircle } from "@phosphor-icons/react";
import type { Usuario } from "@/lib/account";

/**
 * El control de cuenta de la cabecera.
 *
 * Vive DENTRO de la fila de controles, no flotando encima. Antes era un botón `fixed` sobre toda
 * la pantalla y en ventanas estrechas se montaba sobre «Chat»: al estar fuera del `flex` de la
 * cabecera, nada le reservaba sitio. El cajón sí es una capa superpuesta —eso es un cajón—, pero
 * el botón que lo abre es un control más.
 */
export function AccountButton({
  usuario,
  abierto,
  onClick,
}: {
  usuario: Usuario | null;
  abierto: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      aria-label={usuario ? `Cuenta de ${usuario.email}` : "Entrar"}
      title={usuario ? usuario.email : "Entrar"}
      className={`flex max-w-[11rem] items-center gap-1.5 rounded-md border py-1 pl-1 pr-2 text-xs transition-colors ${
        abierto
          ? "border-accent bg-accent-subtle font-medium text-accent"
          : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground"
      }`}
    >
      {usuario ? (
        <>
          <Avatar email={usuario.email} />
          {/* El correo se recorta en vez de empujar: la cabecera ya reparte su ancho entre
              varios grupos, y un correo largo no puede ser quien decida cuánto queda para los
              demás. Completo está en el `title` y en el panel.
              Y por debajo de `xl` desaparece del todo: queda la inicial. Un correo entero se come
              media cabecera, y lo que hace falta saber de un vistazo —que hay alguien dentro, y
              quién— ya lo dicen el círculo y su letra. El correo completo está a un toque, en el
              panel de cuenta. */}
          <span className="hidden truncate xl:inline">{usuario.email}</span>
        </>
      ) : (
        <>
          <UserCircle size={17} aria-hidden className="shrink-0" />
          <span>Entrar</span>
        </>
      )}
    </button>
  );
}

/**
 * Círculo con la inicial. Sin fotos: no hay dónde subirlas ni razón para pedirlas, y una inicial
 * basta para lo único que tiene que hacer — decir de un vistazo que hay alguien dentro.
 */
export function Avatar({ email, grande = false }: { email: string; grande?: boolean }) {
  const inicial = (email.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground ${
        grande ? "h-9 w-9 text-sm" : "h-5 w-5 text-[0.625rem]"
      }`}
    >
      {inicial}
    </span>
  );
}
