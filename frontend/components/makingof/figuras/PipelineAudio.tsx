/**
 * El audio gana una fase previa; el resto entra por donde entraba.
 *
 * Dibujo propio, no captura: ilustra un concepto. Usa los tokens del 5k vía `currentColor` y
 * variables, así que sigue al tema claro/oscuro sin dos versiones. La fase nueva va en tinta (el
 * acento, reservado a lo que de verdad cambia); lo que no cambió va en el gris de siempre, que es
 * justo lo que el dibujo tiene que decir.
 */
export function PipelineAudio() {
  return (
    <svg
      viewBox="0 0 620 150"
      className="h-auto w-full min-w-[520px]"
      role="img"
      aria-label="El audio pasa por una fase de percepción que produce una anotación estructurada, y desde ahí sigue el mismo camino que el texto, el PDF y la imagen: extracción, estructuración y validación."
    >
      <defs>
        <marker id="punta" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" />
        </marker>
        <marker id="punta-tinta" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" className="fill-accent" />
        </marker>
      </defs>

      {/* Fila del audio: la que gana la fase nueva */}
      <g className="text-accent">
        <Caja x={4} y={14} ancho={76} alto={34} etiqueta="audio" tinta />
        <Flecha x1={80} x2={110} y={31} tinta />
        <Caja x={110} y={8} ancho={132} alto={46} etiqueta="Fase 0" sub="percepción" tinta />
        <Flecha x1={242} x2={272} y={31} tinta />
        <Caja x={272} y={8} ancho={122} alto={46} etiqueta="anotación" sub="estructurada" tinta />
        <Flecha x1={394} x2={424} y={31} tinta />
      </g>

      {/* Fila de los demás formatos: sin fase previa */}
      <g className="text-muted">
        <Caja x={4} y={98} ancho={232} alto={34} etiqueta="texto · PDF · imagen" />
        <path
          d="M236 115 H300 Q320 115 320 95 V60 Q320 40 340 40 H424"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          markerEnd="url(#punta)"
        />
      </g>

      {/* El pipeline de siempre, compartido */}
      <g className="text-foreground-secondary">
        <Caja x={424} y={8} ancho={186} alto={124} etiqueta="" />
        <text x={517} y={38} textAnchor="middle" className="fill-current text-[11px]">
          Fase 1 · extracción
        </text>
        <text x={517} y={62} textAnchor="middle" className="fill-current text-[11px]">
          Fase 2 · estructuración
        </text>
        <text x={517} y={86} textAnchor="middle" className="fill-current text-[11px]">
          Fase 3 · validación
        </text>
        <text x={517} y={112} textAnchor="middle" className="fill-current text-[10px] opacity-70">
          sin cambios
        </text>
      </g>
    </svg>
  );
}

function Caja({
  x,
  y,
  ancho,
  alto,
  etiqueta,
  sub,
  tinta = false,
}: {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  etiqueta: string;
  sub?: string;
  tinta?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={ancho}
        height={alto}
        rx={6}
        fill="none"
        stroke="currentColor"
        strokeWidth={tinta ? 1.5 : 1.25}
      />
      {etiqueta ? (
        <text
          x={x + ancho / 2}
          y={sub ? y + alto / 2 - 2 : y + alto / 2 + 4}
          textAnchor="middle"
          className="fill-current text-[11px]"
        >
          {etiqueta}
        </text>
      ) : null}
      {sub ? (
        <text
          x={x + ancho / 2}
          y={y + alto / 2 + 14}
          textAnchor="middle"
          className="fill-current text-[10px] opacity-75"
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Flecha({ x1, x2, y, tinta = false }: { x1: number; x2: number; y: number; tinta?: boolean }) {
  return (
    <line
      x1={x1}
      x2={x2}
      y1={y}
      y2={y}
      stroke="currentColor"
      strokeWidth="1.25"
      markerEnd={tinta ? "url(#punta-tinta)" : "url(#punta)"}
    />
  );
}
