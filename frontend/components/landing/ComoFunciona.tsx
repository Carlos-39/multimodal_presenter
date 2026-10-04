"use client";

import { FileAudio, FilePdf, FileText, Image as ImageIcon } from "@phosphor-icons/react";
import { useEnPantalla } from "@/hooks/useEnPantalla";

/**
 * De dónde sale y en qué se convierte.
 *
 * El dibujo es propio, con los tokens: sigue al tema claro y oscuro sin dos versiones, y no es
 * una captura de nada. Las líneas se dibujan al entrar en pantalla porque **el recorrido es el
 * contenido**: cuatro formatos distintos entran por el mismo sitio y salen como lo mismo. Una
 * imagen fija lo diría; dibujarse lo explica.
 */
const ENTRADAS = [
  { Icono: FileText, etiqueta: "Un texto" },
  { Icono: FilePdf, etiqueta: "Un PDF" },
  { Icono: ImageIcon, etiqueta: "Una imagen" },
  { Icono: FileAudio, etiqueta: "Una grabación" },
];

const SALIDAS = ["Secciones con su fuente", "Preguntas respondidas", "Diapositivas y voz"];

export function ComoFunciona() {
  const { ref, visible } = useEnPantalla<HTMLDivElement>();

  return (
    <section className="border-t border-border">
      <div ref={ref} data-visible={visible} className="mx-auto max-w-6xl px-5 py-20">
        <div className="revelar" data-visible={visible}>
          <h2 className="max-w-[18ch] font-sans text-[1.75rem] font-medium leading-[1.1] tracking-[-0.022em] text-foreground sm:text-[2.25rem]">
            Cómo funciona
          </h2>
          <p className="mt-4 max-w-[54ch] font-serif text-[1.0625rem] leading-[1.65] text-foreground-secondary">
            Lo que subes no se convierte a texto antes de leerlo. Entra entero, se entiende entero,
            y lo que sale conserva el camino de vuelta a cada frase.
          </p>
        </div>

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[auto_1fr_auto]">
          <ul className="flex flex-wrap gap-2.5 lg:flex-col">
            {ENTRADAS.map(({ Icono, etiqueta }, i) => (
              <li
                key={etiqueta}
                className="revelar flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-2.5"
                data-visible={visible}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <Icono size={16} aria-hidden className="shrink-0 text-muted" />
                <span className="whitespace-nowrap text-sm text-foreground-secondary">
                  {etiqueta}
                </span>
              </li>
            ))}
          </ul>

          <Confluencia />

          <ul className="flex flex-wrap gap-2.5 lg:flex-col">
            {SALIDAS.map((salida, i) => (
              <li
                key={salida}
                className="revelar rounded-lg border border-accent/35 bg-accent-subtle px-3.5 py-2.5 text-sm text-accent"
                data-visible={visible}
                style={{ transitionDelay: `${700 + i * 90}ms` }}
              >
                {salida}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Las cuatro entradas confluyen en un punto y salen como tres cosas. */
function Confluencia() {
  // Las curvas salen de cuatro alturas distintas al mismo centro, y de ahí a tres.
  const entra = [14, 60, 106, 152];
  const sale = [36, 83, 130];

  return (
    <svg
      viewBox="0 0 320 166"
      className="h-28 w-full lg:h-44"
      role="img"
      aria-label="Las cuatro clases de documento entran por el mismo sitio y salen como secciones con su fuente, preguntas respondidas, y diapositivas y voz."
    >
      {entra.map((y, i) => (
        <path
          key={`e${y}`}
          d={`M0 ${y} C 70 ${y}, 90 83, 155 83`}
          className="trazo stroke-border-strong"
          style={{ ["--largo" as string]: 260, animationDelay: `${i * 90}ms` }}
          fill="none"
          strokeWidth="1.25"
        />
      ))}

      {sale.map((y, i) => (
        <path
          key={`s${y}`}
          d={`M165 83 C 230 83, 250 ${y}, 320 ${y}`}
          className="trazo stroke-accent/60"
          style={{ ["--largo" as string]: 260, animationDelay: `${650 + i * 90}ms` }}
          fill="none"
          strokeWidth="1.25"
        />
      ))}

      <circle cx="160" cy="83" r="7" className="fill-accent" />
      <circle cx="160" cy="83" r="14" className="fill-accent/15" />
    </svg>
  );
}
