import type { ComponentType } from "react";
import { Quotes, SpeakerHigh } from "@phosphor-icons/react/dist/ssr";
import { Barra } from "./Barra";

/**
 * Las capacidades del carrusel, cada una con su lámina.
 *
 * Las láminas son **tipografía y formas con los tokens**, no capturas ni ventanas dibujadas. Cada
 * una enseña lo que la capacidad produce, en el mismo lenguaje visual en que lo produce: una
 * sección con su cita se ve como una sección con su cita. Así lo que se promete aquí es
 * literalmente lo que aparece después.
 */
export interface Capacidad {
  id: string;
  titulo: string;
  descripcion: string;
  Lamina: ComponentType;
}

export const CAPACIDADES: Capacidad[] = [
  {
    id: "lectura",
    titulo: "Lectura estructurada",
    descripcion:
      "El documento se reorganiza en secciones, con lo esencial separado del detalle. Empiezas por lo esencial y abres el detalle cuando quieras.",
    Lamina: LaminaLectura,
  },
  {
    id: "rastro",
    titulo: "El camino de vuelta",
    descripcion:
      "Cada sección trae al pie la frase del original de la que salió. Un clic y la tienes señalada en el documento.",
    Lamina: LaminaRastro,
  },
  {
    id: "chat",
    titulo: "Pregunta lo que quieras",
    descripcion:
      "El chat relee el documento completo en cada pregunta. No busca en un resumen, así que no se le escapa lo que el resumen dejó fuera.",
    Lamina: LaminaChat,
  },
  {
    id: "region",
    titulo: "El recuadro sobre la frase",
    descripcion:
      "En un PDF con texto, la cita no te deja en la página: te deja un recuadro sobre la frase exacta, en la página dibujada.",
    Lamina: LaminaRegion,
  },
  {
    id: "audio",
    titulo: "También escucha",
    descripcion:
      "Sube una grabación y distingue quién dijo qué. Al abrir la fuente, el reproductor arranca en el segundo de la cita.",
    Lamina: LaminaAudio,
  },
  {
    id: "generar",
    titulo: "Diapositivas y narración",
    descripcion:
      "Una presentación para exponer y un audio para escuchar, escritos desde el documento original y no desde el resumen.",
    Lamina: LaminaGenerar,
  },
];

/* ── Láminas ──────────────────────────────────────────────── */

function LaminaLectura() {
  return (
    <div className="w-full max-w-sm">
      <p className="font-serif text-sm text-foreground">El quetzal resplandeciente</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {[1, 2].map((n) => (
          <div key={n} className="rounded-lg border border-border bg-background px-3.5 py-3">
            <Barra ancho="55%" tono="fuerte" />
            <div className="mt-2 flex flex-col gap-1.5">
              <Barra ancho="100%" />
              <Barra ancho="78%" />
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-dashed border-border px-3.5 py-3 opacity-60">
          <div className="flex items-center gap-2">
            <Barra ancho="40%" />
            <span className="text-[0.625rem] text-muted">detalle</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LaminaRastro() {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-lg border border-border bg-background px-3.5 py-3">
        <p className="font-serif text-xs leading-5 text-foreground-secondary">
          Anida en troncos muertos de aguacatillo, cuyo fruto es su alimento principal.
        </p>
        <div className="mt-3 flex items-start gap-1.5 border-t border-border pt-2.5">
          <Quotes size={11} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-muted" />
          <p className="font-serif text-[0.6875rem] italic leading-4 text-foreground-secondary">
            <mark className="bg-highlight text-foreground">
              Anida en troncos muertos de aguacatillo
            </mark>
          </p>
        </div>
      </div>
      <div className="my-2 flex justify-center">
        <svg width="12" height="22" viewBox="0 0 12 22" aria-hidden>
          <path d="M6 0 V16 M2 12 L6 17 L10 12" fill="none" className="stroke-accent" strokeWidth="1.25" />
        </svg>
      </div>
      <div className="rounded-lg border border-dashed border-border px-3.5 py-3">
        <p className="font-serif text-[0.6875rem] leading-[1.7] text-muted">
          …los machos lucen dos plumas caudales de hasta un metro.{" "}
          <mark className="bg-highlight text-foreground">
            Anida en troncos muertos de aguacatillo
          </mark>
          , cuyo fruto es su alimento principal…
        </p>
      </div>
    </div>
  );
}

function LaminaChat() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <p className="self-end rounded-lg rounded-br-sm bg-accent-subtle px-3 py-2 text-xs text-accent">
        ¿De qué se alimenta?
      </p>
      <div className="rounded-lg rounded-bl-sm border border-border bg-background px-3.5 py-3">
        <p className="font-serif text-xs leading-5 text-foreground-secondary">
          Su alimento principal es el fruto del aguacatillo, el mismo árbol en cuyos troncos
          muertos anida.
        </p>
        <p className="mt-2.5 border-t border-border pt-2 font-serif text-[0.6875rem] italic leading-4 text-muted">
          <mark className="bg-highlight not-italic text-foreground">Fuente</mark> cuyo fruto es su
          alimento principal
        </p>
      </div>
    </div>
  );
}

function LaminaRegion() {
  return (
    <div className="w-full max-w-[13rem]">
      <div className="relative aspect-[3/4] rounded-md border border-border bg-background p-4">
        <div className="flex flex-col gap-[7px]">
          {["70%", "100%", "95%", "88%"].map((a, i) => (
            <Barra key={i} ancho={a} />
          ))}
        </div>
        <div className="relative mt-3 rounded-[3px] ring-2 ring-highlight">
          <div className="flex flex-col gap-[7px] px-1 py-1">
            <Barra ancho="92%" tono="fuerte" />
            <Barra ancho="64%" tono="fuerte" />
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-[7px]">
          {["100%", "83%", "97%", "45%"].map((a, i) => (
            <Barra key={i} ancho={a} />
          ))}
        </div>
        <span className="absolute bottom-2 right-3 font-mono text-[0.5625rem] tabular-nums text-muted">
          p. 4
        </span>
      </div>
    </div>
  );
}

function LaminaAudio() {
  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3.5 py-3">
        <SpeakerHigh size={15} aria-hidden className="shrink-0 text-accent" />
        <div className="h-1 flex-1 rounded-full bg-border">
          <div className="h-1 w-1/3 rounded-full bg-accent" />
        </div>
        <span className="font-mono text-[0.625rem] tabular-nums text-muted">0:05</span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {[
          { quien: "Hablante 1", dice: "La rotación fue del 12 %." },
          { quien: "Hablante 2", dice: "A mí me salió 15 %, contando temporales." },
        ].map((t) => (
          <div key={t.quien} className="rounded-lg border border-border px-3 py-2">
            <p className="text-[0.625rem] text-accent">{t.quien}</p>
            <p className="mt-0.5 font-serif text-xs leading-5 text-foreground-secondary">
              {t.dice}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Las dos piezas que esta capacidad promete, las dos a la vista.
 *
 * Antes era una caja 16:9 con dos barras y unos puntos debajo, y no se leía como una diapositiva:
 * le faltaba todo lo que hace que una diapositiva parezca una diapositiva (que haya más detrás,
 * que lleve su número) y faltaba entera la mitad de la narración, que está en el título de la
 * capacidad y no aparecía por ningún lado.
 *
 * Ahora hay una pila asomando, el número de lámina, y debajo la banda de audio con su onda y su
 * duración. Sin capturas: todo dibujado con los tokens, como las figuras del «cómo se construyó».
 */
const ONDA = [5, 9, 14, 8, 17, 11, 6, 13, 18, 10, 7, 15, 9, 12, 6, 16, 8, 11, 5, 13];

function LaminaGenerar() {
  return (
    <div className="w-full max-w-sm">
      <div className="relative">
        {/* Las de detrás: sin ellas una diapositiva suelta es solo un recuadro. */}
        <span
          aria-hidden
          className="absolute -top-2.5 left-4 right-4 h-3 rounded-t-lg border border-b-0 border-border bg-surface-sunken"
        />
        <span
          aria-hidden
          className="absolute -top-1.5 left-2 right-2 h-3 rounded-t-lg border border-b-0 border-border bg-surface"
        />

        <div className="relative aspect-video rounded-lg border border-border bg-background p-4">
          <p className="font-serif text-sm text-foreground">Causa del declive</p>
          <div className="mt-3 flex flex-col gap-2">
            {["92%", "74%"].map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-1 w-1 shrink-0 rounded-full bg-accent" />
                <Barra ancho={a} />
              </div>
            ))}
          </div>
          <span className="absolute bottom-2.5 right-3 font-mono text-[0.5625rem] tabular-nums text-muted">
            3 / 8
          </span>
        </div>
      </div>

      {/* La narración. La onda va en acento hasta donde se ha escuchado y en borde lo que falta:
          la misma idea de progreso que el reproductor de verdad. */}
      <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2">
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-subtle"
        >
          <span className="ml-[1px] border-y-[3px] border-l-[5px] border-y-transparent border-l-accent" />
        </span>
        <span aria-hidden className="flex flex-1 items-center gap-[2px]">
          {ONDA.map((h, i) => (
            <span
              key={i}
              className={`w-[2px] rounded-full ${i < 8 ? "bg-accent" : "bg-border-strong"}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </span>
        <span className="shrink-0 font-mono text-[0.5625rem] tabular-nums text-muted">2:14</span>
      </div>
    </div>
  );
}
