"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { AuthForm } from "@/components/shell/AuthForm";
import { Artefacto } from "./Artefacto";

/**
 * La portada: lo primero que ve quien llega sin haber usado nunca la aplicación.
 *
 * Decisiones que la gobiernan:
 *
 * **El héroe no es una captura falsa ni un degradado.** Es el artefacto real que produce la
 * aplicación —una afirmación, su cita y el pasaje resaltado en el documento—, compuesto con los
 * mismos tokens. Mostrar el producto es más honesto que ilustrarlo, y en este producto el
 * producto es tipográfico.
 *
 * **Entrar ocurre AQUÍ.** `AuthForm` se extrajo del cajón de cuenta exactamente para esto: una
 * copia del acceso en la landing habría divergido en silencio de la del cajón. Quien crea su
 * cuenta desde la portada llega a la aplicación ya dentro, sin pasar por una pantalla intermedia.
 *
 * **Sin cuenta se puede todo menos guardar**, y eso se dice en el botón: «Probar como invitado» no
 * es una versión recortada, es la aplicación.
 */
export function Landing({ onEntrar }: { onEntrar: () => void }) {
  const [acceso, setAcceso] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Multimodal Presenter
          </span>
          <Link
            href="/making-of"
            className="text-xs text-foreground-secondary transition-colors hover:text-foreground"
          >
            Cómo se construyó
          </Link>
        </div>
      </header>

      <main>
        <Hero onInvitado={onEntrar} onAcceso={() => setAcceso(true)} />
        <Entradas />
        <Fidelidad />
        <NoHace />
        <MakingOf />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-muted">
          Prototipo de trabajo de grado. Universidad del Valle.
        </div>
      </footer>

      {acceso ? <DialogoAcceso onCerrar={() => setAcceso(false)} onDentro={onEntrar} /> : null}
    </div>
  );
}

function Hero({ onInvitado, onAcceso }: { onInvitado: () => void; onAcceso: () => void }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.15fr_minmax(0,24rem)] lg:gap-14 lg:pt-20">
      <div>
        {/* Dos líneas en escritorio. La medida y la escala se eligen JUNTAS: con 16ch y 56px el
            titular caía en cinco líneas, que siempre es un error de tamaño, no de longitud. */}
        <h1 className="max-w-[32ch] font-serif text-[2.25rem] leading-[1.15] text-foreground sm:text-[2.5rem] lg:text-[2.75rem]">
          Entiende un documento difícil. Comprueba cada frase.
        </h1>
        <p className="mt-6 max-w-[48ch] font-serif text-[1.0625rem] leading-[1.65] text-foreground-secondary">
          Sube un PDF, una grabación o un texto. Cada frase de la explicación te lleva al punto
          exacto del original.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
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
        <p className="mt-4 text-xs text-muted">
          Sin cuenta funciona todo. Entrar sirve para guardar y volver.
        </p>
      </div>

      <Artefacto />
    </section>
  );
}

/** Tres maneras de entrar al mismo documento. Una pesa más que las otras dos, y se ve. */
function Entradas() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="max-w-[20ch] font-serif text-[1.75rem] leading-tight text-foreground sm:text-[2rem]">
          Tres maneras de entrar al mismo documento
        </h2>

        <div className="mt-9 grid gap-4 lg:grid-cols-3">
          <article className="rounded-lg border border-border bg-surface p-6 lg:col-span-2">
            <h3 className="font-serif text-lg text-foreground">Lectura estructurada</h3>
            <p className="mt-2 max-w-[52ch] text-sm leading-6 text-foreground-secondary">
              El documento se reorganiza en secciones, con lo esencial separado del detalle. Puedes
              quedarte en lo esencial o abrir el detalle cuando quieras.
            </p>
            <p className="mt-4 max-w-[52ch] text-sm leading-6 text-foreground-secondary">
              Cada sección trae al pie la frase del original de la que salió. Si esa frase no se
              puede localizar, la aplicación lo dice y no ofrece el enlace.
            </p>
          </article>

          <div className="grid gap-4">
            <article className="rounded-lg border border-border bg-surface p-6">
              <h3 className="font-serif text-lg text-foreground">Preguntas</h3>
              <p className="mt-2 text-sm leading-6 text-foreground-secondary">
                El chat relee el documento completo en cada pregunta. No busca en un resumen, así
                que no se le escapa lo que el resumen dejó fuera.
              </p>
            </article>
            <article className="rounded-lg border border-border bg-surface p-6">
              <h3 className="font-serif text-lg text-foreground">Diapositivas y voz</h3>
              <p className="mt-2 text-sm leading-6 text-foreground-secondary">
                Una presentación para exponer y una narración para escuchar, escritas desde el
                documento original.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

/** La tabla que hace la promesa concreta. Es el diferenciador, y es honesto por construcción. */
function Fidelidad() {
  const filas: [string, string][] = [
    ["Un texto", "El fragmento exacto, resaltado"],
    ["Un PDF con texto", "Un recuadro sobre la frase, en su página"],
    ["Una grabación", "El reproductor salta al segundo de la cita"],
    ["Una imagen o un PDF escaneado", "La página donde está, sin prometer más"],
  ];

  return (
    <section className="border-t border-border bg-surface-sunken/40">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="max-w-[24ch] font-serif text-[1.75rem] leading-tight text-foreground sm:text-[2rem]">
          Cada fuente promete lo que puede sostener
        </h2>
        <p className="mt-4 max-w-[58ch] text-sm leading-6 text-foreground-secondary">
          Según de dónde venga el documento, se puede señalar con más o menos precisión. La
          aplicación te dice cuál de los cuatro niveles alcanzó, y nunca finge el siguiente.
        </p>

        <dl className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {filas.map(([fuente, promesa]) => (
            <div key={fuente} className="border-t border-border pt-4">
              <dt className="text-sm font-medium text-foreground">{fuente}</dt>
              <dd className="mt-1 text-sm leading-6 text-foreground-secondary">{promesa}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** La sección que casi nadie pone. Es la que hace creíbles las otras cuatro. */
function NoHace() {
  const puntos = [
    "Si una frase no se puede anclar a una cita exacta, la aplicación lo dice y retira el enlace a la fuente. No inventa una cita que respalde lo que afirma.",
    "Las ilustraciones que genera llevan siempre, y de forma permanente, una etiqueta que dice que no vienen del documento.",
    "Con un PDF escaneado te lleva a la página y ahí se queda. Señalar la frase exacta requeriría reconocer el texto de la imagen, y eso no se hace.",
  ];

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="max-w-[20ch] font-serif text-[1.75rem] leading-tight text-foreground sm:text-[2rem]">
          Lo que no hace, dicho aquí
        </h2>
        <div className="mt-8 grid gap-7 lg:max-w-[72ch]">
          {puntos.map((punto) => (
            <p key={punto} className="font-serif text-[1.0625rem] leading-[1.6] text-foreground-secondary">
              {punto}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function MakingOf() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-14 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-[1.75rem] leading-tight text-foreground">
            Cómo se construyó
          </h2>
          <p className="mt-2 max-w-[56ch] text-sm leading-6 text-foreground-secondary">
            Catorce capítulos sobre qué se construyó, por qué, y qué apareció al medirlo. Incluido
            lo que no funcionó.
          </p>
        </div>
        <Link
          href="/making-of"
          className="shrink-0 rounded-md border border-border px-5 py-2.5 text-sm text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          Leer los capítulos
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
