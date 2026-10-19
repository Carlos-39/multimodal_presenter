import Link from "next/link";
import type { Metadata } from "next";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Indice } from "@/components/makingof/Indice";
import { CAPITULOS } from "@/content/makingOf";
import { ACTOS, escrito, type Acto } from "@/lib/makingOf";

export const metadata: Metadata = {
  title: "Cómo se construyó · Multimodal Presenter",
  description:
    "Catorce capítulos sobre qué se construyó, por qué, y qué apareció al medirlo. Incluido lo que no funcionó.",
};

/**
 * El índice ES la versión corta.
 *
 * Cada capítulo lleva su conclusión en una línea, así que quien lea solo estas catorce líneas ya
 * se lleva la historia, y quien quiera entra. Es el progressive disclosure que la aplicación
 * aplica al contenido (resumen / detallado), aplicado aquí a su propio relato.
 */
export default function IndiceMakingOf() {
  const actos = [...new Set(CAPITULOS.map((c) => c.acto))];
  const listos = CAPITULOS.filter(escrito).length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <h1 className="max-w-[20ch] font-serif text-[2.25rem] leading-[1.15] text-foreground sm:text-[2.75rem]">
        Cómo se construyó
      </h1>
      <p className="mt-5 max-w-[60ch] font-serif text-[1.0625rem] leading-[1.65] text-foreground-secondary">
        Catorce capítulos sobre qué se construyó, por qué, y qué apareció al medirlo. Las cifras
        salen de mediciones reales, no de estimaciones. El último capítulo es lo que no se hizo.
      </p>
      <p className="mt-4 text-xs text-muted">
        Cada capítulo lleva su conclusión debajo: leyendo solo esas líneas ya está la historia.
      </p>

      {/* El árbol primero y la lista después, que es el mismo progressive disclosure que aplica
          la aplicación: aquí está la forma entera de un vistazo (cinco actos, catorce capítulos,
          cuál es más largo) y abajo cada uno con lo que concluye. Es lo único que se mueve solo en
          esta página: se dibuja una vez al llegar y se acabó. */}
      <div className="mt-10 rounded-xl border border-border bg-surface/60 px-5 py-4 sm:px-6">
        <Indice variante="portada" />
      </div>

      <div className="mt-14 flex flex-col gap-12">
        {actos.map((acto) => (
          <Seccion key={acto} acto={acto} />
        ))}
      </div>

      {listos < CAPITULOS.length ? (
        <p className="mt-14 border-t border-border pt-5 text-xs leading-5 text-muted">
          {listos} de {CAPITULOS.length} capítulos escritos. Los demás están en el índice con su
          conclusión; el texto completo llega por tandas.
        </p>
      ) : null}
    </main>
  );
}

function Seccion({ acto }: { acto: Acto }) {
  const capitulos = CAPITULOS.filter((c) => c.acto === acto);
  return (
    <section>
      <h2 className="text-xs font-medium text-muted">{ACTOS[acto]}</h2>
      <ol className="mt-4 flex flex-col">
        {capitulos.map((capitulo) => {
          const listo = escrito(capitulo);
          const fila = (
            <>
              <div className="flex items-baseline gap-3">
                <span
                  className={`w-5 shrink-0 font-mono text-xs tabular-nums transition-colors ${
                    listo ? "text-muted group-hover:text-accent" : "text-muted"
                  }`}
                >
                  {capitulo.numero}
                </span>
                <h3
                  className={`font-serif text-[1.125rem] leading-snug transition-colors ${
                    listo
                      ? "text-foreground underline decoration-transparent decoration-1 underline-offset-[5px] group-hover:decoration-accent"
                      : "text-foreground-secondary"
                  }`}
                >
                  {capitulo.titulo}
                </h3>
              </div>
              <p className="ml-8 mt-1 max-w-[62ch] text-sm leading-6 text-foreground-secondary">
                {capitulo.conclusion}
              </p>
              <p className="ml-8 mt-1.5 text-xs text-muted">
                {capitulo.hitos}
                {listo ? null : " · por escribir"}
              </p>
            </>
          );

          return (
            <li key={capitulo.slug} className="border-b border-border last:border-b-0">
              {listo ? (
                /*
                 * Que se vea que esto se pulsa **sin pasar el ratón por encima**. Antes la fila
                 * era un enlace sin ninguna marca: solo se enteraba quien ya lo sospechaba, y en
                 * una pantalla táctil no se entera nadie.
                 *
                 * En reposo ya hay dos señales: el filo a la izquierda (la misma rama del árbol
                 * de arriba) y el ángulo a la derecha. Al pasar por encima las dos se encienden en
                 * acento y el título se subraya, que es lo que confirma lo que ya se intuía.
                 */
                <Link
                  href={`/making-of/${capitulo.slug}`}
                  className="group relative block py-4 pl-4 pr-8 transition-colors hover:bg-surface-sunken/40"
                >
                  <span
                    aria-hidden
                    className="absolute bottom-3.5 left-0 top-3.5 w-px bg-border transition-colors group-hover:bg-accent"
                  />
                  {fila}
                  <CaretRight
                    size={14}
                    aria-hidden
                    className="absolute right-2 top-[1.35rem] text-muted opacity-45 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100 motion-reduce:transition-none"
                  />
                </Link>
              ) : (
                <div className="py-4 pl-4 opacity-70">{fila}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
