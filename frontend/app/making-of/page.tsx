import Link from "next/link";
import type { Metadata } from "next";
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

      <div className="mt-12 flex flex-col gap-12">
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
                <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-muted">
                  {capitulo.numero}
                </span>
                <h3
                  className={`font-serif text-[1.125rem] leading-snug ${
                    listo ? "text-foreground" : "text-foreground-secondary"
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
                <Link
                  href={`/making-of/${capitulo.slug}`}
                  className="block py-4 transition-colors hover:bg-surface-sunken/40"
                >
                  {fila}
                </Link>
              ) : (
                <div className="py-4 opacity-70">{fila}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
