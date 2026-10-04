/**
 * La misma regla, en los tres anchos.
 *
 * **Tres ventanas dibujadas a escala relativa, no tres plantillas.** Lo que la figura tiene que
 * dejar claro es que el contenido NUNCA se aplasta: cada umbral admite una columna más solo
 * cuando cabe con ancho legible, y cuando deja de caber, la columna no se encoge — se va.
 *
 * El contenido va en tinta en las tres: es lo único que está siempre, y verlo conservar su sitio
 * mientras lo de al lado desaparece es el argumento del capítulo.
 *
 * Las etiquetas van **a la izquierda de su caja y no centradas**: en el tercer ancho el panel se
 * superpone al contenido, y dos etiquetas centradas se pisaban hasta volverse ilegibles. Alinear
 * a la izquierda las separa sin mover ninguna caja.
 */
const X0 = 190;
const ESCALA = 2.1;
const ALTO = 50;
const SEP = 66;
const HUECO = 4;

const NAV = 26;
const CONTENIDO = 74;
const COLUMNA = 46;

const u = (unidades: number) => unidades * ESCALA;
const X_CONTENIDO = X0 + u(NAV) + HUECO;
const DER_CONTENIDO = X_CONTENIDO + u(CONTENIDO);

const VENTANAS = [
  { desde: "≥ 1280 px", nota: "caben las dos", columnas: ["fuente", "chat"], oculta: null, encima: null },
  {
    desde: "1024 – 1280 px",
    nota: "cabe una: la que abriste de última",
    columnas: ["chat"],
    oculta: "fuente",
    encima: null,
  },
  {
    desde: "< 1024 px",
    nota: "se superponen, de una en una",
    columnas: [],
    oculta: null,
    encima: "fuente",
  },
];

export function Umbrales() {
  return (
    <svg
      viewBox={`0 0 620 ${VENTANAS.length * SEP + 18}`}
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Tres anchos de ventana. A partir de 1280 píxeles el nav fijo, el contenido y las dos columnas opcionales, fuente y chat, caben a la vez. Entre 1024 y 1280 solo cabe una: se muestra la que se abrió de última y la otra queda oculta, sigue abierta en el estado y reaparece al ensanchar. Por debajo de 1024 las columnas se superponen al contenido, de una en una. El contenido conserva su ancho en los tres casos."
    >
      {VENTANAS.map((v, fila) => {
        const y = 14 + fila * SEP;
        return (
          <g key={v.desde}>
            <text x={4} y={y + 20} className="fill-current font-mono text-[10px] text-foreground">
              {v.desde}
            </text>
            <text x={4} y={y + 34} className="fill-current text-[9px] text-muted">
              {v.nota}
            </text>

            <Caja x={X0} y={y} ancho={u(NAV)} etiqueta="nav" tono="quieto" />
            <Caja
              x={X_CONTENIDO}
              y={y}
              ancho={u(CONTENIDO)}
              etiqueta="contenido"
              tono="contenido"
            />

            {v.columnas.map((c, i) => (
              <Caja
                key={c}
                x={DER_CONTENIDO + HUECO + i * (u(COLUMNA) + HUECO)}
                y={y}
                ancho={u(COLUMNA)}
                etiqueta={c}
                tono="quieto"
              />
            ))}

            {/* Oculta: se dibuja apartada y en punteado. Sigue existiendo en el estado, y lo dice
                dentro de su propia caja para no salirse del lienzo. */}
            {v.oculta ? (
              <Caja
                x={DER_CONTENIDO + HUECO + u(COLUMNA) + HUECO + 6}
                y={y}
                ancho={u(COLUMNA)}
                etiqueta={v.oculta}
                sub="sigue abierta"
                tono="oculto"
              />
            ) : null}

            {/* Encima: ocupa la mitad derecha del contenido, que es lo que hace de verdad. */}
            {v.encima ? (
              <Caja
                x={DER_CONTENIDO - u(44)}
                y={y + 7}
                alto={ALTO - 14}
                ancho={u(44)}
                etiqueta={v.encima}
                tono="encima"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function Caja({
  x,
  y,
  ancho,
  alto = ALTO,
  etiqueta,
  sub,
  tono,
}: {
  x: number;
  y: number;
  ancho: number;
  alto?: number;
  etiqueta: string;
  sub?: string;
  tono: "quieto" | "contenido" | "oculto" | "encima";
}) {
  const color =
    tono === "contenido" || tono === "encima"
      ? "text-accent"
      : tono === "oculto"
        ? "text-muted"
        : "text-foreground-secondary";

  return (
    <g className={color} opacity={tono === "oculto" ? 0.6 : 1}>
      <rect
        x={x}
        y={y}
        width={ancho}
        height={alto}
        rx={4}
        fill={tono === "encima" ? "currentColor" : "none"}
        fillOpacity={tono === "encima" ? 0.14 : 0}
        stroke="currentColor"
        strokeWidth={tono === "contenido" ? 1.5 : 1}
        strokeDasharray={tono === "oculto" ? "3 3" : undefined}
      />
      <text
        x={x + 8}
        y={y + alto / 2 + (sub ? -1 : 3)}
        className="fill-current text-[9px]"
      >
        {etiqueta}
      </text>
      {sub ? (
        <text x={x + 8} y={y + alto / 2 + 11} className="fill-current text-[8px] opacity-80">
          {sub}
        </text>
      ) : null}
    </g>
  );
}
