/**
 * La forma de los datos decide, y el código corrige.
 *
 * **Dos filas porque hay dos desenlaces, y el segundo es el que casi nadie implementa.** Arriba,
 * el tipo elegido no cabe en la forma y se corrige en silencio. Abajo, NINGÚN tipo cabe, y
 * entonces no se dibuja nada: se degrada a tabla y se dice. Enseñar solo la corrección dejaría
 * pensar que siempre hay un gráfico, que es justo la mentira que este capítulo desmonta.
 *
 * El tipo descartado se tacha en vez de desaparecer: lo que el modelo pidió forma parte de la
 * historia, y borrarlo contaría que acertó.
 */
export function Isomorfismo() {
  return (
    <svg
      viewBox="0 0 620 220"
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Dos casos. Con un eje ordenado por años, los tipos admisibles son barra y línea: la tarta queda descartada porque una progresión no son partes de un todo, y el tipo se corrige a línea en silencio. Con datos desalineados, tres categorías y dos valores, no hay ningún tipo admisible: la sección se degrada a tabla y lo dice con una leyenda visible."
    >
      <defs>
        <marker id="iso-p" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" />
        </marker>
      </defs>

      {/* Caso 1 · el tipo se corrige */}
      <g className="text-foreground-secondary">
        <text x={4} y={14} className="fill-current text-[10px] text-muted">
          el eje está ordenado
        </text>
        <Datos x={4} y={22} filas={["2019  2020  2021", "  12    19    31"]} />

        <path
          d="M156 46 H196"
          stroke="currentColor"
          strokeWidth="1.25"
          markerEnd="url(#iso-p)"
          className="trazo"
          style={{ ["--largo" as string]: 40 }}
        />

        <text x={204} y={36} className="fill-current text-[10px]">
          admisibles
        </text>
        <Pildora x={204} y={42} texto="bar" />
        <Pildora x={246} y={42} texto="line" />
        <Pildora x={292} y={42} texto="pie" tachado />
        <text x={336} y={56} className="fill-current text-[9px] opacity-70">
          una progresión no son partes de un todo
        </text>

        <path
          d="M204 78 H560"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.5"
        />
      </g>

      <g className="text-accent">
        <text x={204} y={94} className="fill-current text-[10px]">
          el modelo pidió
        </text>
        <Pildora x={286} y={82} texto="pie" />
        <text x={330} y={94} className="fill-current text-[10px]">
          → se corrige a
        </text>
        <Pildora x={414} y={82} texto="line" relleno />
        <text x={462} y={94} className="fill-current text-[9px] opacity-75">
          en silencio: es consistencia
        </text>
      </g>

      {/* Caso 2 · no hay gráfico posible */}
      <g className="text-foreground-secondary">
        <text x={4} y={138} className="fill-current text-[10px] text-muted">
          los datos no cuadran
        </text>
        <Datos x={4} y={146} filas={["Norte  Sur  Este", "  412  390"]} />

        <path
          d="M156 170 H196"
          stroke="currentColor"
          strokeWidth="1.25"
          markerEnd="url(#iso-p)"
          className="trazo"
          style={{ ["--largo" as string]: 40, animationDelay: "0.3s" }}
        />

        <text x={204} y={160} className="fill-current text-[10px]">
          admisibles
        </text>
        <text x={204} y={178} className="fill-current font-mono text-[10px] opacity-60">
          ninguno
        </text>
      </g>

      <g className="text-warning">
        <text x={286} y={166} className="fill-current text-[10px]">
          → se degrada a tabla
        </text>
        <rect
          x={286}
          y={174}
          width={212}
          height={30}
          rx={4}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.7"
        />
        <text x={298} y={193} className="fill-current text-[9px]">
          y lo dice con una leyenda visible
        </text>
      </g>
    </svg>
  );
}

function Datos({ x, y, filas }: { x: number; y: number; filas: string[] }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={148}
        height={48}
        rx={5}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.7"
      />
      {filas.map((f, i) => (
        <text
          key={i}
          x={x + 12}
          y={y + 20 + i * 16}
          className="fill-current font-mono text-[9px]"
          xmlSpace="preserve"
        >
          {f}
        </text>
      ))}
    </g>
  );
}

function Pildora({
  x,
  y,
  texto,
  tachado = false,
  relleno = false,
}: {
  x: number;
  y: number;
  texto: string;
  tachado?: boolean;
  relleno?: boolean;
}) {
  const ancho = 38;
  return (
    <g opacity={tachado ? 0.55 : 1}>
      <rect
        x={x}
        y={y}
        width={ancho}
        height={18}
        rx={9}
        fill={relleno ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
      />
      <text
        x={x + ancho / 2}
        y={y + 12.5}
        textAnchor="middle"
        className={`font-mono text-[9px] ${relleno ? "fill-surface" : "fill-current"}`}
      >
        {texto}
      </text>
      {tachado ? (
        <line
          x1={x + 3}
          x2={x + ancho - 3}
          y1={y + 9}
          y2={y + 9}
          stroke="currentColor"
          strokeWidth="1.25"
        />
      ) : null}
    </g>
  );
}
