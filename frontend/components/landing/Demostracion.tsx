"use client";

import { useEffect, useRef, useState } from "react";
import { Quotes } from "@phosphor-icons/react";
import { MUESTRAS } from "./muestras";

/**
 * El héroe: la aplicación, jugable, antes de entrar.
 *
 * **Sustituye a una ilustración que se reproducía una vez y se quedaba muerta.** El argumento del
 * proyecto es un gesto —pulsas una frase escrita y te lleva a la del original— y un gesto se
 * demuestra, no se describe. Aquí se pulsa de verdad: no hay llamadas a la API ni coste por
 * visita, el contenido es fijo, pero el movimiento es el mismo que dentro.
 *
 * **El movimiento lo dispara quien mira**, que es la única clase de movimiento que esta portada se
 * permite repartir. La única excepción es el primer encendido: al cargar, la primera sección se
 * selecciona sola pasado un momento, para que nadie se quede delante de una demostración apagada
 * sin saber que se puede tocar. Con «reducir movimiento» pasa al instante.
 *
 * Las tres pestañas no son tres adornos: cada entrada devuelve una clase distinta de prueba, y la
 * etiqueta de cada cita lo dice sin suavizarlo. Ver `muestras.tsx`.
 */
const ESPERA_PRIMER_ENCENDIDO_MS = 1400;

export function Demostracion() {
  const [cual, setCual] = useState(0);
  const [activa, setActiva] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelDoc = useRef<HTMLDivElement>(null);

  const muestra = MUESTRAS[cual];
  const seccionActiva = muestra.secciones.find((s) => s.id === activa) ?? null;

  // El primer encendido, una sola vez en toda la visita.
  useEffect(() => {
    const primera = MUESTRAS[0].secciones[0].id;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      // En un microtask: la regla de pureza del proyecto prohíbe `setState` síncrono en un efecto.
      queueMicrotask(() => setActiva(primera));
      return;
    }
    const t = setTimeout(() => setActiva(primera), ESPERA_PRIMER_ENCENDIDO_MS);
    return () => clearTimeout(t);
  }, []);

  /**
   * Pulsar una sección enciende su frase, y asegura que la frase esté a la vista.
   *
   * En móvil los dos paneles se apilan y el documento queda arriba: pulsar una sección podía
   * resaltar algo fuera de la pantalla, o sea no demostrar nada. `block: "nearest"` **no hace nada
   * si el documento ya se ve**, así que en escritorio no mueve ni un píxel y en un móvil estrecho
   * sube exactamente lo que falte.
   */
  function verSeccion(id: string) {
    setActiva(id);
    panelDoc.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  /** Cambiar de entrada deja siempre algo encendido: la demostración no vuelve a apagarse. */
  function elegir(i: number) {
    const j = (i + MUESTRAS.length) % MUESTRAS.length;
    setCual(j);
    setActiva(MUESTRAS[j].secciones[0].id);
  }

  function teclas(e: React.KeyboardEvent, i: number) {
    const salto = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!salto) return;
    e.preventDefault();
    const j = (i + salto + MUESTRAS.length) % MUESTRAS.length;
    elegir(j);
    tabs.current[j]?.focus();
  }

  return (
    <div className="surgir" style={{ animationDelay: "0.15s" }}>
      <div role="tablist" aria-label="Qué subes" className="flex flex-wrap gap-1.5">
        {MUESTRAS.map((m, i) => {
          const puesta = i === cual;
          return (
            <button
              key={m.id}
              ref={(n) => {
                tabs.current[i] = n;
              }}
              role="tab"
              id={`entrada-${m.id}`}
              aria-selected={puesta}
              aria-controls="demostracion"
              tabIndex={puesta ? 0 : -1}
              onClick={() => elegir(i)}
              onKeyDown={(e) => teclas(e, i)}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                puesta
                  ? "border-accent bg-accent-subtle text-accent"
                  : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground"
              }`}
            >
              <m.Icono size={14} aria-hidden className="shrink-0" />
              {m.etiqueta}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="demostracion"
        aria-labelledby={`entrada-${muestra.id}`}
        className="mt-3 rounded-xl border border-border bg-surface p-3.5 sm:p-4"
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* El documento va primero también en móvil: al pulsar una sección, lo que se enciende
              tiene que estar ya en pantalla, no debajo del pulgar. */}
          <div ref={panelDoc}>
            <p className="mb-2 text-[0.6875rem] text-muted">Tu documento</p>
            <div className="rounded-lg border border-dashed border-border px-3 py-2.5">
              <muestra.Documento activa={activa} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-[0.6875rem] text-muted">Lo que la aplicación escribe</p>
            <div className="flex flex-col gap-2">
              {muestra.secciones.map((s) => {
                const puesta = s.id === activa;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={puesta}
                    onClick={() => verSeccion(s.id)}
                    className={`block rounded-lg border bg-background px-3 py-2.5 text-left transition-colors ${
                      puesta
                        ? "border-accent"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    <h3 className="font-serif text-[0.8125rem] text-foreground">{s.titulo}</h3>
                    <p className="mt-1 font-serif text-xs leading-[1.55] text-foreground-secondary">
                      {s.cuerpo}
                    </p>
                    {puesta ? (
                      <span className="mt-2 flex items-start gap-1.5 border-t border-border pt-2">
                        <Quotes
                          size={10}
                          weight="fill"
                          aria-hidden
                          className="mt-[3px] shrink-0 text-muted"
                        />
                        <span className="font-serif text-[0.6875rem] italic leading-[1.45] text-foreground-secondary">
                          {s.cita}{" "}
                          <span className="whitespace-nowrap not-italic text-muted">
                            — {s.pie}
                          </span>
                        </span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p
          role="status"
          className="mt-3 border-t border-border pt-2.5 text-[0.6875rem] leading-[1.5] text-muted"
        >
          {seccionActiva ? muestra.nota : "Pulsa una sección para ver de dónde salió."}
        </p>
      </div>
    </div>
  );
}
