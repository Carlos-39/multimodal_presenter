import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Armazon } from "@/components/makingof/Armazon";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

/**
 * El armazón del «making of». Deliberadamente más desnudo que la aplicación: aquí no hay nada que
 * operar, solo que leer. Una barra fina para volver, y nada más compitiendo con el texto.
 *
 * El fondo ya no es plano: cada acto tiene su tono, y el índice vive fijo al lado del capítulo.
 * Las dos cosas salen del mismo dato (el acto que cada capítulo ya declara) y las monta `Armazon`,
 * que necesita saber en qué ruta estamos.
 */
export default function MakingOfLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          {/* A `/inicio`, no a `/`: `/` es una puerta que, con la cookie puesta, lleva a la
              aplicación. Volver desde aquí tiene que devolver a la portada de la que se vino. */}
          <Link
            href="/inicio"
            className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} aria-hidden />
            Multimodal Presenter
          </Link>
          <span aria-hidden className="text-muted">
            /
          </span>
          <Link href="/making-of" className="text-xs text-foreground-secondary hover:text-foreground">
            Cómo se construyó
          </Link>
          {/* El mismo botón de la aplicación y de la portada, con el mismo almacenamiento: leer
              estos capítulos de noche no debería obligar a salir a cambiar el tema. */}
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <Armazon>{children}</Armazon>
    </div>
  );
}
