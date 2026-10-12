"use client";

import { FileAudio, FilePdf, FileText, Image as ImageIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
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

/**
 * Cuántos milisegundos se queda encendida cada entrada antes de pasar a la siguiente.
 */
const ENCENDIDO_MS = 1500;

export function ComoFunciona() {
  const { ref, visible } = useEnPantalla<HTMLDivElement>();
  /**
   * El recorrido: `-1` antes de empezar, `0..3` una entrada encendida cada vez, y al llegar a `4`
   * se encienden las cuatro y se queda ahí.
   *
   * **Termina.** La sección defiende que metas lo que metas sale lo mismo, y encender las cuatro
   * entradas una a una contra las mismas tres salidas ES esa frase. Un bucle eterno la diría una
   * vez y después solo pediría atención; dejando las cuatro encendidas al final, el estado de
   * reposo del dibujo es la conclusión.
   */
  const [paso, setPaso] = useState(-1);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    if (!visible || quieto || paso >= ENTRADAS.length) return;
    // El `setState` va dentro del temporizador, no en el cuerpo del efecto.
    const t = setTimeout(() => setPaso((p) => p + 1), paso < 0 ? 450 : ENCENDIDO_MS);
    return () => clearTimeout(t);
  }, [visible, paso, quieto]);

  const todas = paso >= ENTRADAS.length;
  const activa = todas ? null : paso;

  return (
    <section className="border-t border-border">
      <div
        ref={ref}
        data-visible={visible}
        className="mx-auto max-w-6xl px-5 py-20"
        onPointerEnter={() => setQuieto(true)}
        onPointerLeave={() => setQuieto(false)}
      >
        <div className="revelar" data-visible={visible}>
          <h2 className="max-w-[18ch] font-sans text-[2rem] font-medium leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[2.6rem]">
            Cómo funciona
          </h2>
          <p className="mt-4 max-w-[54ch] font-serif text-[1.1875rem] leading-[1.6] text-foreground-secondary">
            Lo que subes no se convierte a texto antes de leerlo. Entra entero, se entiende entero,
            y lo que sale conserva el camino de vuelta a cada frase.
          </p>
        </div>

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[auto_1fr_auto]">
          <ul className="flex flex-wrap gap-2.5 lg:flex-col">
            {ENTRADAS.map(({ Icono, etiqueta }, i) => (
              <li
                key={etiqueta}
                className={`revelar flex items-center gap-2.5 rounded-lg border bg-surface px-3.5 py-2.5 transition-colors duration-500 ${
                  activa === i || todas ? "border-accent/50" : "border-border"
                }`}
                data-visible={visible}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <Icono
                  size={16}
                  aria-hidden
                  className={`shrink-0 transition-colors duration-500 ${
                    activa === i || todas ? "text-accent" : "text-muted"
                  }`}
                />
                <span
                  className={`whitespace-nowrap text-sm transition-colors duration-500 ${
                    activa === i || todas ? "text-foreground" : "text-foreground-secondary"
                  }`}
                >
                  {etiqueta}
                </span>
              </li>
            ))}
          </ul>

          <Confluencia activa={activa} todas={todas} />

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
function Confluencia({ activa, todas }: { activa: number | null; todas: boolean }) {
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
          className={`trazo transition-[stroke,stroke-width] duration-500 motion-reduce:transition-none ${
            activa === i || todas ? "stroke-accent" : "stroke-border-strong"
          }`}
          style={{
            ["--largo" as string]: 260,
            animationDelay: `${i * 90}ms`,
            strokeWidth: activa === i || todas ? 2 : 1.25,
          }}
          fill="none"
          strokeWidth="1.25"
        />
      ))}

      {sale.map((y, i) => (
        <path
          key={`s${y}`}
          d={`M165 83 C 230 83, 250 ${y}, 320 ${y}`}
          // Las salidas se encienden un poco DESPUÉS que la entrada: es lo que hace que se lea
          // como un recorrido y no como dos cosas que se iluminan a la vez.
          className={`trazo transition-[stroke,stroke-width] duration-500 motion-reduce:transition-none ${
            activa !== null || todas ? "stroke-accent" : "stroke-accent/40"
          }`}
          style={{
            ["--largo" as string]: 260,
            animationDelay: `${650 + i * 90}ms`,
            transitionDelay: "260ms",
            strokeWidth: activa !== null || todas ? 1.9 : 1.25,
          }}
          fill="none"
        />
      ))}

      <circle cx="160" cy="83" r="7" className="fill-accent" />
      <circle cx="160" cy="83" r="14" className="fill-accent/15" />
    </svg>
  );
}
