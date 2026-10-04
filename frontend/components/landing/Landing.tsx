"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "@phosphor-icons/react";
import { AuthForm } from "@/components/shell/AuthForm";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Carrusel } from "./Carrusel";
import { ComoFunciona } from "./ComoFunciona";
import { Demostracion } from "./Demostracion";
import { Preguntas } from "./Preguntas";
import { Problema } from "./Problema";

/**
 * La portada.
 *
 * **Sin cuenta se puede todo menos guardar**, y eso se dice en el botón: «Probar como invitado»
 * no es una versión recortada, es la aplicación.
 *
 * **Entrar ocurre AQUÍ.** `AuthForm` se extrajo del cajón de cuenta exactamente para esto: una
 * copia del acceso en la portada habría divergido en silencio de la del cajón.
 *
 * Los límites del sistema no tienen sección propia: viven en las preguntas frecuentes. Dicho al
 * paso frena a quien todavía no sabe qué es esto; dicho allí contesta a quien ya pregunta.
 */
export function Landing({ onEntrar }: { onEntrar: () => void }) {
  const [acceso, setAcceso] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Multimodal Presenter
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/making-of"
              className="hidden text-xs text-foreground-secondary transition-colors hover:text-foreground sm:block"
            >
              Cómo se construyó
            </Link>
            {/* El MISMO botón del núcleo fijo de la aplicación. Elegir claro u oscuro no es una
                preferencia de la aplicación sino de quien mira, así que tiene que poder hacerse
                desde el primer momento, no solo después de entrar. Y es el mismo componente, con
                el mismo almacenamiento: el tema que elijas aquí es el que te encuentras dentro. */}
            <ThemeToggle />
            <button
              type="button"
              onClick={onEntrar}
              className="rounded-md bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              Probar
            </button>
          </nav>
        </div>
      </header>

      <main>
        <Hero onInvitado={onEntrar} onAcceso={() => setAcceso(true)} />
        <Problema />
        <ComoFunciona />
        <Carrusel />
        <Preguntas />
        <Cierre onInvitado={onEntrar} />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted">
          <span>Prototipo de trabajo de grado. Universidad del Valle.</span>
          <Link href="/making-of" className="transition-colors hover:text-foreground">
            Cómo se construyó
          </Link>
        </div>
      </footer>

      {acceso ? <DialogoAcceso onCerrar={() => setAcceso(false)} onDentro={onEntrar} /> : null}
    </div>
  );
}

/**
 * El héroe, a una sola columna y con la demostración a lo ancho.
 *
 * Estuvo en dos columnas mientras el visual era una ilustración estrecha. La demostración son dos
 * paneles —el documento y lo que la aplicación escribe— y en media pantalla cada panel quedaba en
 * 300 px: se lee peor justo donde hay que leer. A lo ancho cada panel tiene el doble, y el titular
 * conserva su medida en vez de partirse en cinco líneas para dejarle hueco.
 */
function Hero({ onInvitado, onAcceso }: { onInvitado: () => void; onAcceso: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 pt-14 lg:pt-20">
      <h1
        className="surgir max-w-[32ch] font-serif text-[2.25rem] leading-[1.15] text-foreground sm:text-[2.5rem] lg:text-[2.75rem]"
        style={{ animationDelay: "0.05s" }}
      >
        Entiende un documento difícil. Comprueba cada frase.
      </h1>
      <p
        className="surgir mt-5 max-w-[52ch] font-serif text-[1.0625rem] leading-[1.65] text-foreground-secondary"
        style={{ animationDelay: "0.2s" }}
      >
        Sube un PDF, una grabación o un texto. Cada frase de la explicación te lleva al punto
        exacto del original.
      </p>
      <div
        className="surgir mt-7 flex flex-wrap items-center gap-3"
        style={{ animationDelay: "0.3s" }}
      >
        <button
          type="button"
          onClick={onInvitado}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Probar como invitado
        </button>
        <button
          type="button"
          onClick={onAcceso}
          className="rounded-md border border-border px-5 py-2.5 text-sm text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          Entrar
        </button>
      </div>
      <p className="surgir mt-4 text-xs text-muted" style={{ animationDelay: "0.4s" }}>
        Sin cuenta funciona todo. Entrar sirve para guardar y volver.
      </p>

      <div className="mt-11">
        <Demostracion />
      </div>
    </section>
  );
}

/**
 * El cierre: el único sitio de la portada donde el tipo manda.
 *
 * Todos los titulares de la página miden lo mismo, y eso deja el final sin peso: se llega al
 * último bloque igual que al tercero. Aquí la escala sube de golpe porque **es el único momento
 * que pide una decisión**. Nada más cambia: ni color de acento nuevo, ni fondo, ni movimiento.
 * Una cosa grande y lo demás callado.
 */
function Cierre({ onInvitado }: { onInvitado: () => void }) {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-24 lg:py-28">
        <div className="flex flex-col items-start gap-8">
          <h2 className="max-w-[17ch] font-serif text-[2.5rem] leading-[1.05] tracking-[-0.015em] text-foreground sm:text-[3.25rem] lg:text-[3.75rem]">
            Trae un documento que te cueste leer.
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onInvitado}
              className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              Probar como invitado
            </button>
            <span className="text-xs text-muted">Sin cuenta y sin instalar nada.</span>
          </div>
        </div>

        <Link
          href="/making-of"
          className="group mt-14 flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h3 className="font-serif text-xl text-foreground">Cómo se construyó</h3>
            <p className="mt-2 max-w-[54ch] text-sm leading-6 text-foreground-secondary">
              Catorce capítulos sobre qué se construyó, por qué, y qué apareció al medirlo.
              Incluido lo que no funcionó.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-accent transition-colors group-hover:text-accent-hover">
            Leer los capítulos
            <ArrowRight size={14} aria-hidden />
          </span>
        </Link>
      </div>
    </section>
  );
}

/**
 * El acceso, sobre la portada. Reusa `AuthForm`, el mismo del cajón de cuenta: una copia aquí
 * habría divergido de la otra en silencio, que es la peor forma de divergir.
 */
function DialogoAcceso({ onCerrar, onDentro }: { onCerrar: () => void; onDentro: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onCerrar}
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-acceso"
        className="section-enter relative w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-acceso" className="font-serif text-xl text-foreground">
            Entrar
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="mt-5">
          <AuthForm onUsuario={() => onDentro()} />
        </div>
      </div>
    </div>
  );
}
