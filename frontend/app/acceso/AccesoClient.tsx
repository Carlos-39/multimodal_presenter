"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

/**
 * Pedir el código de acceso.
 *
 * **Casi nadie debería ver esta pantalla.** El enlace que reparte el facilitador ya lleva el
 * código, así que un participante entra de un toque y esto no llega a aparecer. Está para quien
 * llega sin él: dice qué hace falta, sin insinuar que hay algo que descubrir.
 *
 * El formulario navega en vez de enviar: el código viaja como parámetro y es el proxy quien lo
 * comprueba, antes de que exista ninguna página. Y `destino` vuelve tal cual llegó, para que quien
 * abrió `/?p=P07` acabe en `/?p=P07` y no en la portada.
 */
export function AccesoClient({ destino }: { destino: string }) {
  const [codigo, setCodigo] = useState("");

  function entra(evento: React.FormEvent) {
    evento.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("c", codigo.trim());
    url.searchParams.set("destino", destino);
    // `assign` y no `replace`: si el código está mal, el botón de atrás sigue sirviendo.
    window.location.assign(url.toString());
  }

  return (
    <div className="foco flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5">
          <span className="text-sm font-medium tracking-tight text-foreground">
            Multimodal Presenter
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Esto se abre con un código
        </h1>
        <p className="mt-2 text-sm leading-6 text-foreground-secondary">
          Es un prototipo de un trabajo de grado, y cada documento que transforma cuesta dinero de
          verdad. Si vienes a una sesión, el enlace que te pasaron ya trae el código.
        </p>

        <form onSubmit={entra} className="mt-7 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-foreground-secondary">
            Código
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="rounded-md border border-border bg-background px-2.5 py-2 font-mono text-sm font-normal tracking-wide text-foreground transition-colors hover:border-border-strong"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Entrar
          </button>
        </form>
      </main>
    </div>
  );
}
