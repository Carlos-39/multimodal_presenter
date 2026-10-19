"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { capituloPorSlug } from "@/content/makingOf";
import { ACTOS } from "@/lib/makingOf";
import { Indice } from "./Indice";
import { Papel } from "./Papel";

/**
 * El armazón de la bitácora: el papel del acto y el índice.
 *
 * **El índice va fijo mientras se lee un capítulo y no en la portada.** Son dos momentos
 * distintos: en la portada estás eligiendo y el árbol es lo que vienes a mirar, así que vive
 * dentro de la página y en grande; dentro de un capítulo estás leyendo y lo que hace falta es
 * poder saltar sin perder el sitio. Tenerlo en los dos lados sería enseñarlo dos veces en la misma
 * pantalla.
 *
 * Fijo solo desde `lg`. Por debajo de eso, quitarle 15rem a una columna de lectura es quitarle lo
 * que la hace legible, así que ahí es un cajón.
 *
 * La columna de texto se corre a la derecha lo que mide el rail, para que siga centrada en el
 * hueco que queda y no en la ventana: centrada en la ventana se vería empujada contra el índice.
 */
export function Armazon({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const slug = ruta.startsWith("/making-of/") ? ruta.slice("/making-of/".length) : null;
  const capitulo = slug ? capituloPorSlug(slug) : null;

  return (
    <>
      <Papel acto={capitulo?.acto ?? null} />

      {capitulo ? (
        <>
          <aside className="fixed bottom-0 left-0 top-[3.25rem] z-10 hidden w-60 overflow-y-auto border-r border-border px-4 py-5 lg:block">
            <Indice actual={capitulo.slug} />
          </aside>
          {/* `key` por ruta: al cambiar de capítulo el cajón vuelve a nacer cerrado. Es la forma
              de React de reiniciar estado cuando cambia una entrada, y evita el efecto que lo
              cerraba a mano: fijar estado dentro de un efecto encadena renders. */}
          <Cajon key={ruta} slug={capitulo.slug} acto={capitulo.acto} />
        </>
      ) : null}

      <div className={capitulo ? "lg:pl-60" : undefined}>{children}</div>
    </>
  );
}

/** El índice en pantallas donde no cabe fijo. */
function Cajon({ slug, acto }: { slug: string; acto: keyof typeof ACTOS }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed bottom-5 left-5 z-20 flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground-secondary shadow-float transition-colors hover:border-border-strong hover:text-foreground lg:hidden"
      >
        <List size={14} aria-hidden />
        Índice
      </button>

      {abierto ? (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar el índice"
            onClick={() => setAbierto(false)}
            className="backdrop-enter absolute inset-0 bg-black/40"
          />
          <div className="drawer-enter absolute inset-y-0 left-0 flex w-[20rem] max-w-full flex-col border-r border-border bg-surface shadow-float">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-xs font-medium text-foreground">{ACTOS[acto]}</span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-muted transition-colors hover:text-foreground"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <Indice actual={slug} onIr={() => setAbierto(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * El nombre del acto al margen, como el titulillo de un libro.
 *
 * Aparece **después** de que el papel se asiente, cuando ya llevas un rato leyendo: ahí es cuando
 * sirve de algo saber en qué parte de la historia estás. Dice lo mismo que el tono del papel, con
 * palabras, por si el tono no se nota.
 */
export function RotuloActo({ acto }: { acto: keyof typeof ACTOS }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, []);
  return (
    <span
      aria-hidden
      data-visible={visible}
      className="rotulo pointer-events-none absolute -left-8 top-64 hidden origin-top-left -rotate-90 whitespace-nowrap font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted xl:block"
    >
      {ACTOS[acto]}
    </span>
  );
}
