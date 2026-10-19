"use client";

import { Prohibit } from "@phosphor-icons/react";
import { useAvanceSolo } from "@/hooks/useAvanceSolo";
import { useEnPantalla } from "@/hooks/useEnPantalla";
import { Pixelado } from "./Pixelado";

/**
 * El problema que resuelve, demostrado con un interruptor en vez de contado con un ensayo.
 *
 * **Las dos versiones del párrafo tienen exactamente el mismo texto.** Lo único que cambia al
 * pulsar es si cada afirmación trae de dónde sale. Ahí está el problema entero: un texto generado
 * se lee igual de bien tenga detrás un documento o no tenga nada, y a simple vista no hay forma
 * de distinguirlo.
 *
 * La cuarta afirmación no se puede anclar, y **pierde el enlace en vez de enseñar una cita que no
 * existe**. No es un adorno pesimista: es literalmente lo que hace `ground_section` cuando la cita
 * no aparece en el original (`status: "not_found"`, y la sección se queda sin fuente). Enseñar
 * solo los tres aciertos sería vender otra aplicación.
 */
const AFIRMACIONES: { texto: string; anclada: boolean }[] = [
  { texto: "Los duendes rojos se forman por encima de las nubes de tormenta.", anclada: true },
  { texto: "Su color procede del nitrógeno molecular excitado.", anclada: true },
  { texto: "Duran apenas unos milisegundos.", anclada: true },
  { texto: "Se fotografiaron por primera vez en 1989.", anclada: false },
];

/**
 * El interruptor se mueve solo, **pero solo desde que la sección está en pantalla**.
 *
 * Si arrancara al montar, el párrafo se habría estado volteando mientras nadie lo miraba y
 * llegarías a él en un estado cualquiera. Así llegas siempre a «sin fuente», que es la mitad que
 * plantea el problema, y lo ves cambiar. Se detiene en cuanto tocas uno de los dos botones.
 */
const VUELTA_MS = 5200;

export function Problema() {
  const { ref, visible } = useEnPantalla<HTMLDivElement>("0px 0px -25% 0px");
  const { indice, ir, pausa } = useAvanceSolo(2, VUELTA_MS, visible);
  const conFuente = indice === 1;

  return (
    <section className="relative isolate overflow-hidden border-t border-border bg-surface-sunken/40">
      {/* La trama aparece al pasar por encima y se va al salir. No florece sola: en modo claro
          competía con el texto justo mientras se lee, y una sección que se decora sola convierte
          en decorado lo que es el argumento del proyecto. Los puntos van en la tinta del texto,
          no en el acento: siempre lo contrario del papel, que es de donde sale el contraste. */}
      <Pixelado />
      <div ref={ref} className="mx-auto max-w-3xl px-5 py-20">
        <h2 className="max-w-[24ch] font-sans text-[2rem] font-medium leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[2.6rem]">
          El problema no es escribir el texto. Es poder creerlo.
        </h2>
        <p className="mt-4 max-w-[54ch] font-serif text-[1.1875rem] leading-[1.6] text-foreground-secondary">
          Un resumen generado se lee igual de bien tanto si sale del documento como si no. Ahí está
          la trampa: para comprobarlo tendrías que releer el original entero, que es justo lo que
          querías evitar.
        </p>

        <div className="mt-9 rounded-xl border border-border bg-surface p-5" {...pausa}>
          <div className="flex items-center gap-1.5" role="group" aria-label="Ver el párrafo">
            <Pestana puesta={!conFuente} onClick={() => ir(0)}>
              Sin fuente
            </Pestana>
            <Pestana puesta={conFuente} onClick={() => ir(1)}>
              Con fuente
            </Pestana>
          </div>

          <p className="mt-5 font-serif text-[1.0625rem] leading-[1.85] text-foreground-secondary">
            {AFIRMACIONES.map(({ texto, anclada }) => (
              <span key={texto}>
                {/* Las ancladas se marcan con el resaltador, que es el vocabulario de la propia
                    aplicación. La que no se pudo anclar lleva marca PROPIA (subrayado de puntos y
                    etiqueta), no la ausencia de la otra: «no estar resaltada» es una diferencia
                    que se pierde de un vistazo, y es justo la que hay que ver. */}
                <span
                  className={`rounded-[3px] transition-colors duration-500 ${
                    conFuente && anclada ? "bg-highlight text-foreground" : "bg-transparent"
                  } ${
                    conFuente && !anclada
                      ? "underline decoration-border-strong decoration-dotted underline-offset-[5px]"
                      : ""
                  }`}
                >
                  {texto}
                </span>
                {conFuente && !anclada ? (
                  <span className="ml-1.5 whitespace-nowrap align-[1px] text-[0.6875rem] text-muted">
                    <Prohibit size={10} aria-hidden className="mb-[1px] mr-0.5 inline" />
                    sin fuente
                  </span>
                ) : null}{" "}
              </span>
            ))}
          </p>

          {/* Sin región viva: con el interruptor andando, un lector de pantalla estaría leyendo
              una frase nueva cada cinco segundos. */}
          <p className="mt-4 border-t border-border pt-3 text-[0.8125rem] leading-[1.55] text-muted">
            {conFuente
              ? "Tres afirmaciones salen del documento y se abren en su frase. La cuarta no se pudo anclar, así que pierde el enlace: la aplicación dice que no pudo verificarla en vez de enseñar una cita que no está."
              : "El mismo párrafo, sin nada detrás. Cuatro afirmaciones verosímiles y ninguna manera de saber cuál sale del documento."}
          </p>
        </div>

        {/* La cifra sale del Registro de Hitos, de la medición del Hito 7 F2, y es la razón por la
            que comprobar no se cobra aparte: se calcula donde ya se ancla cada cita. */}
        <p className="mt-9 max-w-[58ch] text-sm leading-[1.7] text-foreground-secondary">
          Localizar las frases de todas las secciones de un documento cuesta entre{" "}
          <span className="tabular text-foreground">80</span> y{" "}
          <span className="tabular text-foreground">130 ms</span>, medido, frente a los 20–60
          segundos que tarda la generación. Poder comprobar sale por el{" "}
          <span className="tabular text-foreground">0,3 %</span> del trabajo.
        </p>
      </div>
    </section>
  );
}

function Pestana({
  puesta,
  onClick,
  children,
}: {
  puesta: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={puesta}
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
        puesta
          ? "border-accent bg-accent-subtle text-accent"
          : "border-border text-foreground-secondary hover:border-border-strong hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
