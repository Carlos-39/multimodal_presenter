"use client";

import { ChatCircleText, ListBullets, Sparkle } from "@phosphor-icons/react";

/**
 * La barra de abajo: lo único de cromo que se añade en pantallas estrechas.
 *
 * **Sustituye al carril, no lo imita.** En escritorio hay un carril a la izquierda con las
 * secciones y lo que se puede generar; por debajo de 768 px ese carril estaba simplemente
 * apagado, y con él desaparecían la navegación por secciones y la narración — no escondidas:
 * inexistentes. Aquí vuelven, con el mismo contenido y otra forma.
 *
 * Abajo y no arriba porque es donde llega el pulgar, y porque la cabecera ya tiene lo suyo: los
 * dos controles de VER, que son los que más se usan leyendo.
 *
 * Tres destinos y no cuatro. El documento no es un destino: es lo que hay detrás siempre, así que
 * no se le pone botón. Y la fuente tampoco, porque no se va a buscar — se llega a ella desde la
 * frase concreta que se quiere comprobar, que es justamente lo que este proyecto defiende.
 */
export type DestinoMovil = "secciones" | "generar" | "chat";

interface BarraInferiorProps {
  activo: DestinoMovil | null;
  onIr: (destino: DestinoMovil) => void;
  /** Cuántas secciones hay, para no ofrecer una lista vacía. */
  secciones: number;
}

const ICONOS = {
  secciones: ListBullets,
  generar: Sparkle,
  chat: ChatCircleText,
} as const;

const ETIQUETAS: Record<DestinoMovil, string> = {
  secciones: "Secciones",
  generar: "Generar",
  chat: "Chat",
};

export function BarraInferior({ activo, onIr, secciones }: BarraInferiorProps) {
  const destinos: DestinoMovil[] = ["secciones", "generar", "chat"];

  return (
    <nav
      aria-label="Secciones de la aplicación"
      // `env(safe-area-inset-bottom)`: en los iPhone con barra de gestos, sin esto el último
      // milímetro de los botones queda debajo de la barra del sistema y no se puede pulsar.
      // `z-50`: por encima de las hojas (z-40), que se apoyan sobre ella. El cajón de la cuenta
      // sube por encima de las dos, porque ese sí es una pantalla aparte.
      className="relative z-50 flex shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {destinos.map((destino) => {
        const Icono = ICONOS[destino];
        const vacio = destino === "secciones" && secciones === 0;
        const esActivo = activo === destino;
        return (
          <button
            key={destino}
            type="button"
            onClick={() => onIr(destino)}
            disabled={vacio}
            aria-current={esActivo ? "true" : undefined}
            // 56 px de alto: por debajo de eso el pulgar falla, y fallar en un control de
            // navegación durante una sesión medida contamina lo que se está midiendo.
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.6875rem] transition-colors disabled:opacity-35 ${
              esActivo ? "text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            <Icono size={20} weight={esActivo ? "fill" : "regular"} aria-hidden />
            {ETIQUETAS[destino]}
          </button>
        );
      })}
    </nav>
  );
}
