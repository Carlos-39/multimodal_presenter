/**
 * Cuándo llega cada sección, por los tres caminos que se midieron.
 *
 * **La fila del medio es la figura entera.** Cuatro puntos apilados en la misma vertical dicen
 * «todas llegaron a la vez» de un vistazo, que es justo lo que una tabla de marcas de tiempo
 * obliga a comparar a mano. Y dicen algo más incómodo: por el camino de en medio el usuario ve
 * su primera sección *más tarde* que por los otros dos, aunque el backend trocee igual.
 *
 * Las marcas son los segundos medidos con el modelo real. Un punto por sección: cuando dos
 * llegaron en el mismo instante, se apilan en la misma vertical en vez de dibujarse una sola,
 * porque lo que hay que ver es cuántas cayeron juntas.
 */
const CAMINOS = [
  {
    etiqueta: "directo al backend",
    llegadas: [
      { t: 7.11, n: 2 },
      { t: 8.2, n: 1 },
      { t: 8.77, n: 1 },
    ],
    veredicto: "trocea",
    roto: false,
  },
  {
    etiqueta: "por el rewrite de Next",
    llegadas: [{ t: 6.77, n: 4 }],
    veredicto: "todas de golpe",
    roto: true,
  },
  {
    etiqueta: "por el route handler",
    llegadas: [
      { t: 5.78, n: 2 },
      { t: 6.72, n: 1 },
      { t: 7.11, n: 1 },
    ],
    veredicto: "trocea",
    roto: false,
  },
];

const X0 = 150;
const X1 = 560;
const T_MAX = 9.5;
const ALTO_FILA = 48;

const px = (t: number) => X0 + (t / T_MAX) * (X1 - X0);

export function Troceo() {
  return (
    <svg
      viewBox={`0 0 620 ${CAMINOS.length * ALTO_FILA + 46}`}
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Cuándo llega cada una de las cuatro secciones por tres caminos. Directo al backend, dos secciones a los 7,11 segundos, una a los 8,20 y otra a los 8,77: trocea. A través del rewrite de Next, las cuatro llegan juntas a los 6,77 segundos. A través del route handler, dos a los 5,78 segundos, una a los 6,72 y otra a los 7,11: vuelve a trocear."
    >
      {/* Eje de tiempo */}
      <g className="text-muted">
        {[0, 2, 4, 6, 8].map((s) => (
          <g key={s}>
            <line
              x1={px(s)}
              x2={px(s)}
              y1={18}
              y2={CAMINOS.length * ALTO_FILA + 18}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.15"
            />
            <text
              x={px(s)}
              y={CAMINOS.length * ALTO_FILA + 34}
              textAnchor="middle"
              className="fill-current font-mono text-[9px]"
            >
              {s}s
            </text>
          </g>
        ))}
        <text x={4} y={14} className="fill-current text-[10px]">
          cada punto es una sección que aparece en pantalla
        </text>
      </g>

      {CAMINOS.map((c, fila) => {
        const y = 32 + fila * ALTO_FILA;
        return (
          <g key={c.etiqueta} className={c.roto ? "text-warning" : "text-accent"}>
            <text x={4} y={y + 4} className="fill-current text-[10px]">
              {c.etiqueta}
            </text>
            <text x={4} y={y + 17} className="fill-current text-[9px] opacity-70">
              {c.veredicto}
            </text>

            <line
              x1={X0}
              x2={X1}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.25"
            />

            {c.llegadas.map((l) =>
              Array.from({ length: l.n }, (_, i) => (
                <circle
                  key={`${l.t}-${i}`}
                  cx={px(l.t)}
                  // Apiladas alrededor de la línea: dos secciones en el mismo instante tienen que
                  // verse como dos, no como una.
                  cy={y - ((l.n - 1) * 9) / 2 + i * 9}
                  r="3.5"
                  fill="currentColor"
                />
              )),
            )}

            <text
              x={px(c.llegadas[c.llegadas.length - 1].t) + 12}
              y={y + 3}
              className="fill-current font-mono text-[9px] opacity-75"
            >
              {c.llegadas[c.llegadas.length - 1].t.toFixed(2)}s
            </text>
          </g>
        );
      })}
    </svg>
  );
}
