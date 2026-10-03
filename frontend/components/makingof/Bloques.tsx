import type { Bloque, Trozo } from "@/lib/makingOf";
import { trozos } from "@/lib/makingOf";
import { PipelineAudio } from "./figuras/PipelineAudio";

/**
 * Cómo se compone un capítulo.
 *
 * Las dos voces tipográficas del 5k siguen significando lo mismo: **Source Serif** es el documento
 * (aquí, la narración), **Geist** es la herramienta (navegación, etiquetas) y **Geist Mono** son
 * los números. El resaltador conserva su significado exacto de la aplicación: marca el rastro de
 * verificación. En la aplicación resalta una cita comprobable; aquí, una cifra que se midió.
 */
export function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <div className="flex flex-col gap-6">
      {bloques.map((bloque, i) => (
        <Uno key={i} bloque={bloque} />
      ))}
    </div>
  );
}

function Uno({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case "encabezado":
      return (
        <h2 className="mt-6 font-serif text-[1.35rem] leading-snug text-foreground">
          {bloque.texto}
        </h2>
      );

    case "prosa":
      return (
        <p className="max-w-[68ch] font-serif text-[1.0625rem] leading-[1.65] text-foreground-secondary">
          <Linea texto={bloque.texto} />
        </p>
      );

    case "cita":
      // Una cita del material de trabajo, con el filete del resaltador: es exactamente lo que el
      // panel de fuente hace con un pasaje del documento.
      return (
        <blockquote className="max-w-[62ch] border-l-2 border-highlight pl-4 font-serif text-[1.0625rem] italic leading-[1.7] text-foreground-secondary">
          {bloque.texto}
        </blockquote>
      );

    case "hallazgo":
      // El hallazgo es la frase que el capítulo existe para poder decir, así que se compone como
      // una afirmación y no como un párrafo más.
      return (
        <p className="max-w-[56ch] border-y border-border py-5 font-serif text-[1.25rem] leading-snug text-foreground">
          {bloque.texto}
        </p>
      );

    case "tabla":
      return <Tabla bloque={bloque} />;

    case "figura":
      return (
        <figure className="my-2 flex flex-col gap-3">
          <div className="overflow-x-auto rounded-lg border border-border bg-surface px-4 py-6">
            {bloque.figura === "pipeline-audio" ? <PipelineAudio /> : null}
          </div>
          <figcaption className="text-xs leading-5 text-muted">{bloque.pie}</figcaption>
        </figure>
      );
  }
}

function Tabla({ bloque }: { bloque: Extract<Bloque, { tipo: "tabla" }> }) {
  return (
    <figure className="my-2 flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-sunken/50">
              {bloque.cabeceras.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`px-3 py-2.5 text-xs font-medium text-foreground-secondary ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloque.filas.map((fila, f) => (
              <tr key={f} className="border-b border-border last:border-b-0">
                {fila.map((celda, c) => (
                  <td
                    key={c}
                    className={
                      c === 0
                        ? "px-3 py-2.5 text-left text-foreground"
                        : // Los números en mono tabular, como en toda la aplicación: es la señal
                          // que dice "esto es un dato", y alinea las columnas sin trucos.
                          "px-3 py-2.5 text-right font-mono tabular-nums text-foreground"
                    }
                  >
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bloque.nota ? (
        <figcaption className="text-xs leading-5 text-muted">{bloque.nota}</figcaption>
      ) : null}
    </figure>
  );
}

/** Compone una línea con sus marcas. Ver `trozos` para por qué el vocabulario es cerrado. */
function Linea({ texto }: { texto: string }) {
  return (
    <>
      {trozos(texto).map((trozo, i) => (
        <Pieza key={i} trozo={trozo} />
      ))}
    </>
  );
}

function Pieza({ trozo }: { trozo: Trozo }) {
  switch (trozo.clase) {
    case "fuerte":
      return <strong className="font-semibold text-foreground">{trozo.texto}</strong>;
    case "marca":
      // El MISMO amarillo que marca un pasaje verificado en el documento fuente. Aquí dice
      // "esto se midió", que es la versión de este documento de la misma promesa.
      return (
        // Conserva la tipografía de la frase: el amarillo ya lleva el significado, y cambiar de
        // fuente a mitad de una oración añade un salto que no dice nada. El mono tabular se
        // reserva a las columnas de números, donde sirve para alinear.
        <mark className="rounded-[2px] bg-highlight px-1 text-foreground">{trozo.texto}</mark>
      );
    case "codigo":
      return (
        <code className="rounded-[3px] bg-surface-sunken px-1 font-mono text-[0.9em] text-foreground">
          {trozo.texto}
        </code>
      );
    default:
      return <>{trozo.texto}</>;
  }
}
