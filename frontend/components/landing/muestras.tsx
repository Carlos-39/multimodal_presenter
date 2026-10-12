import type { ComponentType } from "react";
import { FileAudio, FilePdf, FileText, SpeakerHigh } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Barra } from "./Barra";

/**
 * Las tres muestras de la demostración del héroe.
 *
 * **Son tres porque el camino de vuelta es distinto en cada una, y eso es exactamente lo que hay
 * que enseñar.** No son tres adornos del mismo truco:
 *
 * - `texto`   → la cita se comprueba carácter por carácter contra el original (`verified`).
 * - `pdf`     → no hay texto plano que comparar, así que no se verifica; lo que se gana es un
 *               recuadro sobre la frase, dentro de su página (`unverified` + `region`).
 * - `audio`   → tampoco se verifica (la transcripción es un derivado aplanado de la señal); lo
 *               que se gana es el segundo exacto y quién hablaba (`unverified` + `start_s`).
 *
 * Esa jerarquía sale del contrato de `ground_section`, no de lo que quedaría bonito prometer.
 *
 * **Una imagen no está aquí a propósito.** Para una imagen vuelve la cita como texto pero no hay
 * página, ni región, ni momento: no existe un punto al que llevar a nadie. Es un límite real, así
 * que vive en las preguntas frecuentes y no en el héroe.
 *
 * El texto y el PDF son EL MISMO documento. Cambiar de pestaña entre esos dos no cambia el
 * contenido, cambia la fuerza de la prueba — que es el argumento entero.
 */
export interface SeccionMuestra {
  id: string;
  titulo: string;
  cuerpo: string;
  cita: string;
  /** Qué clase de vuelta ofrece esta cita. Es la etiqueta honesta, no un adorno. */
  pie: string;
}

export interface Muestra {
  id: string;
  etiqueta: string;
  Icono: Icon;
  /** Qué distingue a este caso, en una línea, debajo de la demostración. */
  nota: string;
  secciones: SeccionMuestra[];
  Documento: ComponentType<{ activa: string | null }>;
}

/* ── 1 · Un texto ─────────────────────────────────────────── */

const ANTES = "…fenómenos luminosos transitorios que la aviación reportó durante décadas sin explicación. ";
const FRASE_DONDE = "Los duendes rojos ocurren muy por encima de las tormentas eléctricas intensas.";
const FRASE_COLOR = "Su color procede del nitrógeno molecular excitado por el impacto de electrones.";
const DESPUES = " Duran apenas unos milisegundos, lo que explica que tardaran tanto en fotografiarse…";

function DocumentoTexto({ activa }: { activa: string | null }) {
  return (
    <p className="font-serif text-[0.9375rem] leading-[1.7] text-muted sm:leading-[1.8]">
      {ANTES}
      <Frase encendida={activa === "txt-donde"}>{FRASE_DONDE}</Frase>{" "}
      <Frase encendida={activa === "txt-color"}>{FRASE_COLOR}</Frase>
      {DESPUES}
    </p>
  );
}

/**
 * El resaltado que viaja. La transición va en el color y en el fondo, nunca en la posición: el
 * texto no se mueve, se enciende. Mover la frase obligaría a releerla.
 */
function Frase({ encendida, children }: { encendida: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-[3px] transition-colors duration-500 ${
        encendida ? "bg-highlight text-foreground" : "bg-transparent"
      }`}
    >
      {children}
    </span>
  );
}

/* ── 2 · Un PDF ───────────────────────────────────────────── */

/** La página dibujada, por bloques. Un bloque con `id` es la región de esa cita. */
const PAGINA: { id: string | null; anchos: string[] }[] = [
  { id: null, anchos: ["68%", "100%"] },
  { id: "pdf-donde", anchos: ["97%", "54%"] },
  { id: null, anchos: ["100%", "91%", "86%"] },
  { id: "pdf-color", anchos: ["100%", "44%"] },
  { id: null, anchos: ["94%", "100%", "72%"] },
];

function DocumentoPdf({ activa }: { activa: string | null }) {
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-[11.5rem] rounded-md border border-border bg-background p-3.5">
      <div className="flex flex-col gap-2.5">
        {PAGINA.map((bloque, i) => {
          const puesta = Boolean(bloque.id) && bloque.id === activa;
          return (
            <div
              key={i}
              /* El borde de 2 px está SIEMPRE, y solo cambia de color: así encender la región no
                 desplaza ni una línea de la página. Con `shadow-[…var(--highlight)]` el valor no
                 llegaba a `--tw-shadow` y el recuadro no se pintaba. */
              className={`flex flex-col gap-[6px] rounded-[3px] border-2 px-1 py-[3px] transition-colors duration-500 ${
                puesta ? "border-highlight" : "border-transparent"
              }`}
            >
              {bloque.anchos.map((ancho, j) => (
                <Barra key={j} ancho={ancho} tono={puesta ? "fuerte" : "suave"} />
              ))}
            </div>
          );
        })}
      </div>
      <span className="absolute bottom-2 right-3 font-mono text-[0.625rem] tabular-nums text-muted">
        p. 4
      </span>
    </div>
  );
}

/* ── 3 · Una grabación ────────────────────────────────────── */

const DURACION_S = 125;

const TURNOS: { id: string | null; quien: string; dice: string; en: number }[] = [
  { id: null, quien: "Hablante 1", dice: "La rotación del año pasado fue del 12 %.", en: 12 },
  { id: "aud-cifras", quien: "Hablante 2", dice: "A mí me salió 15 %, contando temporales.", en: 48 },
  {
    id: "aud-pendiente",
    quien: "Hablante 1",
    dice: "Entonces hay que decidir si los temporales entran en el indicador.",
    en: 80,
  },
];

function reloj(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

/**
 * El reproductor se coloca en el segundo de la cita, igual que al abrir la fuente dentro de la
 * aplicación. El cabezal se mueve: aquí el movimiento SÍ informa, porque el momento es la
 * posición. No suena nada — es una maqueta del gesto, no un reproductor.
 */
function DocumentoAudio({ activa }: { activa: string | null }) {
  const turno = TURNOS.find((t) => t.id === activa);
  const segundo = turno?.en ?? 0;
  const avance = (segundo / DURACION_S) * 100;

  return (
    <div>
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
        <SpeakerHigh size={14} aria-hidden className="shrink-0 text-accent" />
        <div className="relative h-1 flex-1 rounded-full bg-border">
          <div
            className="h-1 rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${avance}%` }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-500 ease-out"
            style={{ left: `${avance}%` }}
          />
        </div>
        <span className="font-mono text-[0.6875rem] tabular-nums text-muted">{reloj(segundo)}</span>
      </div>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {TURNOS.map((t) => (
          <li
            key={t.quien + t.en}
            className={`rounded-lg border px-2.5 py-2 transition-colors duration-500 ${
              t.id && t.id === activa ? "border-highlight bg-highlight/25" : "border-border"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[0.6875rem] text-accent">{t.quien}</span>
              <span className="font-mono text-[0.625rem] tabular-nums text-muted">
                {reloj(t.en)}
              </span>
            </div>
            <p className="mt-0.5 font-serif text-[0.8125rem] leading-[1.55] text-foreground-secondary">
              {t.dice}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Las tres, juntas ─────────────────────────────────────── */

export const MUESTRAS: Muestra[] = [
  {
    id: "texto",
    etiqueta: "Un texto",
    Icono: FileText,
    nota: "Con texto la cita se compara con el original carácter por carácter. Es la única entrada en la que la palabra «comprobada» es literal.",
    Documento: DocumentoTexto,
    secciones: [
      {
        id: "txt-donde",
        titulo: "Dónde ocurren",
        cuerpo:
          "Se forman muy por encima de las nubes de tormenta, a altitudes a las que no llega ningún avión comercial.",
        cita: FRASE_DONDE,
        pie: "comprobada en el texto",
      },
      {
        id: "txt-color",
        titulo: "Por qué son rojos",
        cuerpo:
          "El color no sale del rayo, sino del nitrógeno del aire al ser golpeado por electrones.",
        cita: FRASE_COLOR,
        pie: "comprobada en el texto",
      },
    ],
  },
  {
    id: "pdf",
    etiqueta: "Un PDF",
    Icono: FilePdf,
    nota: "El mismo documento, ahora en PDF. No hay texto plano que comparar, así que no se dice «comprobada»: lo que se gana es un recuadro sobre la frase, en su página.",
    Documento: DocumentoPdf,
    secciones: [
      {
        id: "pdf-donde",
        titulo: "Dónde ocurren",
        cuerpo:
          "Se forman muy por encima de las nubes de tormenta, a altitudes a las que no llega ningún avión comercial.",
        cita: FRASE_DONDE,
        pie: "p. 4, con recuadro",
      },
      {
        id: "pdf-color",
        titulo: "Por qué son rojos",
        cuerpo:
          "El color no sale del rayo, sino del nitrógeno del aire al ser golpeado por electrones.",
        cita: FRASE_COLOR,
        pie: "p. 4, con recuadro",
      },
    ],
  },
  {
    id: "audio",
    etiqueta: "Una grabación",
    Icono: FileAudio,
    nota: "En una grabación distingue quién dijo qué, y la cita te deja en el segundo exacto. Tampoco se dice «comprobada»: lo que se busca es la transcripción, no la señal.",
    Documento: DocumentoAudio,
    secciones: [
      {
        id: "aud-cifras",
        titulo: "Dos cifras para lo mismo",
        cuerpo:
          "La reunión maneja dos valores de rotación, según se cuenten o no los contratos temporales.",
        cita: "A mí me salió 15 %, contando temporales.",
        pie: "0:48 · Hablante 2",
      },
      {
        id: "aud-pendiente",
        titulo: "Lo que quedó sin decidir",
        cuerpo:
          "Nadie cerró si los temporales entran en el indicador. Quedó planteado y ahí se quedó.",
        cita: "Entonces hay que decidir si los temporales entran en el indicador.",
        pie: "1:20 · Hablante 1",
      },
    ],
  },
];
