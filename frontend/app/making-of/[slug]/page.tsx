import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Bloques } from "@/components/makingof/Bloques";
import { CAPITULOS, capituloPorSlug } from "@/content/makingOf";
import { ACTOS, escrito } from "@/lib/makingOf";

/** Los capítulos escritos se generan en el build: son contenido fijo, no hay nada que calcular. */
export function generateStaticParams() {
  return CAPITULOS.filter(escrito).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const capitulo = capituloPorSlug(slug);
  if (!capitulo) return { title: "Cómo se construyó · Multimodal Presenter" };
  return {
    title: `${capitulo.titulo} · Cómo se construyó`,
    description: capitulo.conclusion,
  };
}

export default async function CapituloPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const capitulo = capituloPorSlug(slug);
  // Un capítulo sin escribir no es una página vacía: no es una página. El índice ya dice que está
  // por llegar, y prometer una puerta que da a nada es peor que no ponerla.
  if (!capitulo || !escrito(capitulo)) notFound();

  const escritos = CAPITULOS.filter(escrito);
  const i = escritos.findIndex((c) => c.slug === capitulo.slug);
  const anterior = escritos[i - 1];
  const siguiente = escritos[i + 1];

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <p className="text-xs text-muted">
        <span className="font-mono tabular-nums">{capitulo.numero}</span> · {ACTOS[capitulo.acto]}
      </p>
      <h1 className="mt-3 max-w-[22ch] font-serif text-[2rem] leading-[1.18] text-foreground sm:text-[2.5rem]">
        {capitulo.titulo}
      </h1>
      <p className="mt-4 max-w-[60ch] text-sm leading-6 text-foreground-secondary">
        {capitulo.conclusion}
      </p>
      <p className="mt-2 text-xs text-muted">{capitulo.hitos}</p>

      <div className="mt-10">
        <Bloques bloques={capitulo.bloques} />
      </div>

      <nav className="mt-16 flex flex-wrap items-stretch justify-between gap-3 border-t border-border pt-6">
        {anterior ? (
          <Link
            href={`/making-of/${anterior.slug}`}
            className="group flex max-w-[48%] items-start gap-2 text-left"
          >
            <ArrowLeft size={14} aria-hidden className="mt-1 shrink-0 text-muted" />
            <span>
              <span className="block text-xs text-muted">Anterior</span>
              <span className="block font-serif text-sm leading-snug text-foreground-secondary group-hover:text-foreground">
                {anterior.titulo}
              </span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {siguiente ? (
          <Link
            href={`/making-of/${siguiente.slug}`}
            className="group flex max-w-[48%] items-start gap-2 text-right"
          >
            <span>
              <span className="block text-xs text-muted">Siguiente</span>
              <span className="block font-serif text-sm leading-snug text-foreground-secondary group-hover:text-foreground">
                {siguiente.titulo}
              </span>
            </span>
            <ArrowRight size={14} aria-hidden className="mt-1 shrink-0 text-muted" />
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <p className="mt-8 text-xs text-muted">
        <Link href="/making-of" className="text-accent hover:text-accent-hover">
          Todos los capítulos
        </Link>
      </p>
    </main>
  );
}
