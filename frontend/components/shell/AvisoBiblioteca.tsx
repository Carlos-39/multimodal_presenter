"use client";

import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

/**
 * La pista que enseña dónde quedó lo que acabas de guardar.
 *
 * **Aparece después de guardar por primera vez, no al entrar.** Un recorrido de bienvenida llega
 * cuando todavía no hay ninguna pregunta en la cabeza y se salta sin leer; esta llega en el
 * segundo exacto en que alguien acaba de crear algo y no sabe a dónde fue. Es la única de toda la
 * aplicación: si hubiera cinco, se cerrarían las cinco igual de rápido.
 *
 * **No se cierra sola.** Un aviso con temporizador obliga a leer deprisa, y quien use un lector de
 * pantalla o lea despacio lo pierde. Se va al cerrarlo, al pulsar fuera o al irse a la biblioteca
 * — y no vuelve nunca.
 *
 * `role="status"` y no `alert`: informa, no interrumpe, así que no roba el foco.
 */
export function AvisoBiblioteca({ onCerrar }: { onCerrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Pulsar en cualquier otro sitio lo da por leído: es lo que hace todo el mundo sin pensarlo.
    function fuera(e: PointerEvent) {
      if (!caja.current?.contains(e.target as Node)) onCerrar();
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    // En el siguiente ciclo: si no, el mismo clic que guarda cerraría el aviso al instante.
    const t = setTimeout(() => {
      document.addEventListener("pointerdown", fuera);
      document.addEventListener("keydown", escape);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [onCerrar]);

  return (
    <div
      ref={caja}
      role="status"
      className="section-enter absolute right-0 top-[calc(100%+8px)] z-40 w-60 rounded-lg border border-accent bg-surface p-3 shadow-float"
    >
      {/* La flecha apunta al enlace: sin ella el aviso flota y no se sabe de qué habla. */}
      <span
        aria-hidden
        className="absolute -top-[5px] right-6 h-2 w-2 rotate-45 border-l border-t border-accent bg-surface"
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs leading-[1.5] text-foreground-secondary">
          Lo que guardes vive aquí. Puedes volver a ello desde cualquier navegador, con su
          conversación y lo que hayas generado.
        </p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Entendido"
          className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
    </div>
  );
}
