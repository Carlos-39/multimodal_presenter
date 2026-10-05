"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { CAPITULOS } from "@/content/makingOf";
import { ACTOS, escrito, type Acto } from "@/lib/makingOf";

/**
 * Los catorce capítulos como un árbol: los cinco actos y sus capítulos colgando.
 *
 * **Los actos no me los inventé para esto**: están en el contenido desde que se escribió el
 * primer capítulo, y cada capítulo ya sabe a cuál pertenece. El índice y el tono del papel salen
 * del mismo dato, así que no son dos ideas sino una.
 *
 * **La rama del capítulo donde estás va en acento, y el tronco por encima de ella también.** No
 * es un subrayado: es un recorrido, y de un vistazo dice cuánto llevas dentro del acto.
 *
 * **Sin SVG.** El original que inspiró esto calcula las curvas con filas de altura fija, y los
 * títulos de aquí ocupan dos líneas («El hueco que no puede volver a abrirse»): con filas
 * variables el dibujo se descuadra entero. Cada codo es un `::before` con una esquina redondeada,
 * que se adapta solo.
 *
 * Tampoco lleva iconos: estos capítulos van numerados, y el número ya es el marcador.
 */
interface IndiceProps {
  /** El capítulo donde estás. Sin él (la portada) no hay nada marcado. */
  actual?: string;
  /**
   * `rail` abre solo el acto actual y deja plegar los demás — es una columna estrecha al lado de
   * algo que se está leyendo. `portada` los abre todos y se dibuja al entrar: ahí el árbol no
   * acompaña a nada, **es** lo que se viene a mirar.
   */
  variante?: "rail" | "portada";
  onIr?: () => void;
}

const ORDEN = Object.keys(ACTOS) as Acto[];

export function Indice({ actual, variante = "rail", onIr }: IndiceProps) {
  const actoActual = CAPITULOS.find((c) => c.slug === actual)?.acto;
  const [plegados, setPlegados] = useState<Set<Acto>>(() => {
    if (variante === "portada") return new Set();
    // En el rail se pliega todo menos el acto en el que estás: catorce títulos largos en una
    // columna de 15rem son cero orientación.
    return new Set(ORDEN.filter((a) => a !== actoActual));
  });

  return (
    <nav aria-label="Índice de capítulos">
      {ORDEN.map((acto, iActo) => {
        const capitulos = CAPITULOS.filter((c) => c.acto === acto);
        if (!capitulos.length) return null;
        const abierto = !plegados.has(acto);
        const tieneActual = capitulos.some((c) => c.slug === actual);

        return (
          <section key={acto} className="mb-0.5">
            <button
              type="button"
              aria-expanded={abierto}
              onClick={() =>
                setPlegados((s) => {
                  const n = new Set(s);
                  if (n.has(acto)) n.delete(acto);
                  else n.add(acto);
                  return n;
                })
              }
              className={`flex w-full items-center gap-1.5 py-2 text-left text-[0.8125rem] transition-colors ${
                tieneActual
                  ? "font-medium text-foreground"
                  : "text-foreground-secondary hover:text-foreground"
              }`}
            >
              <CaretDown
                size={11}
                aria-hidden
                className={`shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none ${
                  abierto ? "" : "-rotate-90"
                }`}
              />
              {ACTOS[acto]}
              <span className="ml-auto font-mono text-[0.6875rem] tabular-nums text-muted">
                {capitulos.length}
              </span>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="rama ml-[5px] pb-1">
                  {/* El tronco es su propia capa para poder DIBUJARSE en la portada. Como borde
                      del `ul` no se podría animar la altura sin mover las filas. */}
                  <span
                    aria-hidden
                    className={`tronco ${variante === "portada" ? "trazando" : ""}`}
                    style={{ animationDelay: `${iActo * 90}ms` }}
                  />
                  {capitulos.map((c, i) => {
                    const esta = c.slug === actual;
                    const listo = escrito(c);
                    const fila = (
                      <>
                        <span className="w-4 shrink-0 font-mono text-[0.6875rem] tabular-nums opacity-70">
                          {c.numero}
                        </span>
                        <span className="min-w-0">{c.titulo}</span>
                      </>
                    );
                    return (
                      <li
                        key={c.slug}
                        className={`relative ${variante === "portada" ? "surgiendo" : ""}`}
                        data-actual={esta || undefined}
                        style={
                          variante === "portada"
                            ? { animationDelay: `${iActo * 90 + 120 + i * 55}ms` }
                            : undefined
                        }
                      >
                        {listo ? (
                          <Link
                            href={`/making-of/${c.slug}`}
                            onClick={onIr}
                            aria-current={esta ? "page" : undefined}
                            tabIndex={abierto ? undefined : -1}
                            className={`flex gap-2 py-1.5 pl-6 pr-1 text-xs leading-[1.45] transition-colors ${
                              esta
                                ? "font-medium text-accent"
                                : "text-muted hover:text-foreground"
                            }`}
                          >
                            {fila}
                          </Link>
                        ) : (
                          // Un capítulo sin escribir no es una puerta: se ve, no se pulsa.
                          <span className="flex gap-2 py-1.5 pl-6 pr-1 text-xs leading-[1.45] text-muted opacity-50">
                            {fila}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
    </nav>
  );
}
