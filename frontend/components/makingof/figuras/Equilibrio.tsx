/**
 * Por qué hay un cruce: una curva sube con el documento y la otra es plana.
 *
 * **El dibujo existe porque la frase «depende del tamaño del documento» no se entiende sin verlo.**
 * El coste por pregunta de la línea base sube con las páginas (manda el documento entero, aunque
 * esté cacheado); el del RAG vectorial no se entera del tamaño, porque siempre recupera k páginas.
 * Dos rectas de pendiente distinta se cruzan, y ahí está toda la historia.
 *
 * Los puntos son las tres mediciones reales, y las posiciones se CALCULAN desde ellas: no hay una
 * sola coordenada escrita a mano, así que la figura no puede desviarse de los datos.
 */
const MEDIDO = [
  { doc: "Attention", pp: 15, base: 0.0277, vec: 0.0484 },
  { doc: "Juan Valdez", pp: 47, base: 0.0742, vec: 0.048 },
  { doc: "Decreto 1016", pp: 98, base: 0.1045, vec: 0.0582 },
];

const X0 = 62;
const X1 = 566;
const Y0 = 184;
const Y1 = 26;
const PP_MAX = 110;
const USD_MAX = 0.12;

const px = (pp: number) => X0 + (pp / PP_MAX) * (X1 - X0);
const py = (usd: number) => Y0 - (usd / USD_MAX) * (Y0 - Y1);

/** Dónde se cortan los dos tramos entre dos mediciones consecutivas, si es que se cortan. */
function cruce() {
  for (let i = 0; i < MEDIDO.length - 1; i++) {
    const a = MEDIDO[i];
    const b = MEDIDO[i + 1];
    const d0 = a.base - a.vec;
    const d1 = b.base - b.vec;
    if (d0 < 0 && d1 >= 0) {
      const t = d0 / (d0 - d1);
      return { pp: a.pp + t * (b.pp - a.pp), usd: a.vec + t * (b.vec - a.vec) };
    }
  }
  return null;
}

export function Equilibrio() {
  const corte = cruce();
  const linea = (k: "base" | "vec") => MEDIDO.map((m) => `${px(m.pp)},${py(m[k])}`).join(" ");

  return (
    <svg
      viewBox="0 0 620 220"
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Coste por pregunta según el tamaño del documento. La línea base cuesta 0,0277 dólares con 15 páginas, 0,0742 con 47 y 0,1045 con 98: sube con el documento. El RAG vectorial cuesta 0,0484, 0,0480 y 0,0582 en los mismos tres documentos: es prácticamente plano. Las dos curvas se cruzan alrededor de las treinta páginas; por debajo la línea base es más barata, por encima lo es el vectorial."
    >
      {/* Ejes y rejilla mínima */}
      <g className="text-border-strong">
        <line x1={X0} x2={X1} y1={Y0} y2={Y0} stroke="currentColor" strokeWidth="1" />
        <line x1={X0} x2={X0} y1={Y1} y2={Y0} stroke="currentColor" strokeWidth="1" />
      </g>
      <g className="text-muted">
        {[0.04, 0.08, 0.12].map((v) => (
          <g key={v}>
            <line
              x1={X0}
              x2={X1}
              y1={py(v)}
              y2={py(v)}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.18"
            />
            <text
              x={X0 - 8}
              y={py(v) + 3}
              textAnchor="end"
              className="fill-current font-mono text-[9px]"
            >
              ${v.toFixed(2)}
            </text>
          </g>
        ))}
        {MEDIDO.map((m) => (
          <text
            key={m.pp}
            x={px(m.pp)}
            y={Y0 + 14}
            textAnchor="middle"
            className="fill-current font-mono text-[9px]"
          >
            {m.pp} pp
          </text>
        ))}
        <text x={X1} y={Y0 + 28} textAnchor="end" className="fill-current text-[9px]">
          páginas del documento
        </text>
        <text x={X0 - 8} y={Y1 - 8} textAnchor="end" className="fill-current text-[9px]">
          $/pregunta
        </text>
      </g>

      {/* El cruce, antes que las curvas: queda por debajo y no las tapa */}
      {corte ? (
        <g className="text-highlight">
          <line
            x1={px(corte.pp)}
            x2={px(corte.pp)}
            y1={py(corte.usd)}
            y2={Y0}
            stroke="currentColor"
            strokeWidth="1.25"
            strokeDasharray="3 3"
          />
          <circle cx={px(corte.pp)} cy={py(corte.usd)} r="5" fill="currentColor" />
        </g>
      ) : null}

      {/* La línea base: sube con el documento */}
      <g className="text-foreground">
        <polyline
          points={linea("base")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="trazo"
          style={{ ["--largo" as string]: 520 }}
        />
        {MEDIDO.map((m) => (
          <circle key={m.pp} cx={px(m.pp)} cy={py(m.base)} r="3" fill="currentColor" />
        ))}
        <text x={px(98) + 10} y={py(0.1045) + 3} className="fill-current text-[10px]">
          línea base
        </text>
      </g>

      {/* El vectorial: plano */}
      <g className="text-accent">
        <polyline
          points={linea("vec")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeDasharray="5 3"
          className="trazo"
          style={{ ["--largo" as string]: 520, animationDelay: "0.4s" }}
        />
        {MEDIDO.map((m) => (
          <circle key={m.pp} cx={px(m.pp)} cy={py(m.vec)} r="3" fill="currentColor" />
        ))}
        <text x={px(98) + 10} y={py(0.0582) + 3} className="fill-current text-[10px]">
          RAG vectorial
        </text>
      </g>

      {corte ? (
        <text
          x={px(corte.pp)}
          y={Y0 + 28}
          textAnchor="middle"
          className="fill-current text-[9px] text-muted"
        >
          se cruzan hacia las {Math.round(corte.pp)} pp
        </text>
      ) : null}
    </svg>
  );
}
