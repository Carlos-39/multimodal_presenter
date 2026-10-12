/**
 * Qué sobrevive a un parser y qué llega entero.
 *
 * **La mitad de abajo no dibuja un texto peor: dibuja un texto al que le faltan cosas.** La tabla
 * pierde su rejilla y queda como una línea corrida, y la figura no aparece en absoluto — no hay
 * nada que un parser de texto pueda poner en su lugar. Esa ausencia es el argumento del capítulo,
 * así que la figura tiene que dejar el hueco a la vista en vez de rellenarlo.
 *
 * Los dos caminos salen del MISMO documento, dibujado una sola vez.
 */
export function Aplanar() {
  return (
    <svg
      viewBox="0 0 620 230"
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Un mismo documento con una tabla y un gráfico sigue dos caminos. Extraído a texto por un parser, la tabla queda como una línea corrida sin filas ni columnas y el gráfico desaparece sin dejar rastro. Entregado como binario nativo, la página llega entera y el modelo ve la tabla y el gráfico tal como están."
    >
      <defs>
        <marker id="p-mu" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" />
        </marker>
      </defs>

      {/* El documento, una sola vez */}
      <g className="text-foreground-secondary">
        <rect x={4} y={48} width={124} height={134} rx={5} fill="none" stroke="currentColor" strokeWidth="1.25" />
        <text x={66} y={40} textAnchor="middle" className="fill-current text-[10px]">
          el documento
        </text>
        {/* una tabla */}
        <g strokeWidth="1" stroke="currentColor" opacity="0.75">
          <rect x={18} y={62} width={96} height={42} fill="none" />
          <line x1={18} x2={114} y1={76} y2={76} />
          <line x1={18} x2={114} y1={90} y2={90} />
          <line x1={50} x2={50} y1={62} y2={104} />
          <line x1={82} x2={82} y1={62} y2={104} />
        </g>
        {/* un gráfico */}
        <g opacity="0.75">
          <polyline
            points="20,152 42,138 64,144 86,124 112,116"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <line x1={18} x2={114} y1={162} y2={162} stroke="currentColor" strokeWidth="1" />
        </g>
      </g>

      {/* Camino de arriba: el parser */}
      <g className="text-muted">
        <path
          d="M128 100 H170 Q186 100 186 84 V62 Q186 48 202 48 H246"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          markerEnd="url(#p-mu)"
          className="trazo"
          style={{ ["--largo" as string]: 180 }}
        />
        <text x={200} y={40} textAnchor="middle" className="fill-current text-[10px]">
          parser
        </text>

        <rect x={250} y={16} width={366} height={82} rx={5} fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="3 3" />
        <text x={264} y={34} className="fill-current text-[10px] opacity-80">
          texto extraído
        </text>
        <text x={264} y={52} className="fill-current font-mono text-[9px] opacity-70">
          Región Norte 412 Sur 390 Este 288 Oeste 301 …
        </text>
        <text x={264} y={68} className="fill-current text-[9px] opacity-60">
          la rejilla se perdió: qué número va con qué fila
        </text>
        <text x={264} y={86} className="fill-current text-[9px] text-warning">
          del gráfico no queda nada
        </text>
      </g>

      {/* Camino de abajo: binario nativo */}
      <g className="text-accent">
        <path
          d="M128 130 H170 Q186 130 186 146 V168 Q186 182 202 182 H246"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#p-mu)"
          className="trazo"
          style={{ ["--largo" as string]: 180, animationDelay: "0.5s" }}
        />
        <text x={200} y={200} textAnchor="middle" className="fill-current text-[10px]">
          sin parser
        </text>

        <rect x={250} y={126} width={366} height={88} rx={5} fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x={264} y={144} className="fill-current text-[10px]">
          el documento, entero
        </text>
        <g stroke="currentColor" strokeWidth="1" opacity="0.8">
          <rect x={264} y={154} width={96} height={42} fill="none" />
          <line x1={264} x2={360} y1={168} y2={168} />
          <line x1={264} x2={360} y1={182} y2={182} />
          <line x1={296} x2={296} y1={154} y2={196} />
          <line x1={328} x2={328} y1={154} y2={196} />
        </g>
        <polyline
          points="382,192 406,174 430,180 454,158 482,150"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.8"
        />
        <text x={506} y={178} className="fill-current text-[9px] opacity-80">
          la tabla sigue siendo
        </text>
        <text x={506} y={190} className="fill-current text-[9px] opacity-80">
          una tabla
        </text>
      </g>
    </svg>
  );
}
