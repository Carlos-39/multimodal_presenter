/**
 * Qué se vuelve a procesar en cada turno del chat, y qué no.
 *
 * **Las dos barras son del mismo ancho a propósito.** Lo que entra al modelo es idéntico en los
 * dos turnos (el documento completo va siempre), y esa es justamente la decisión que el capítulo
 * defiende. Lo único que cambia es el color del tramo grande: en el primer turno se escribe en
 * caché, del segundo en adelante se lee. Si la segunda barra fuera más corta, el dibujo diría que
 * el documento se recorta, que es lo contrario de lo que pasa.
 *
 * Las cifras son las medidas con el modelo real, no proporciones inventadas.
 */
const TOTAL = 3253;
const DOC = 3223;
// La barra no llega al borde: el tramo de la pregunta mide 4 px (porque a escala ESO es lo que
// mide) y su rótulo necesita vivir fuera. Estirarla hasta el borde cortaba los rótulos; agrandar
// el tramo de la pregunta para que cupiera el texto dentro habría mentido sobre la proporción,
// que es justo lo que la figura existe para enseñar.
const ANCHO = 404;
const X0 = 108;

export function CacheChat() {
  const anchoDoc = (DOC / TOTAL) * ANCHO;

  return (
    <svg
      viewBox="0 0 620 160"
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="En los dos turnos entra el documento completo, 3223 tokens, más la pregunta. En el primer turno el documento se escribe en caché; del segundo en adelante se lee de caché, a alrededor del diez por ciento del coste del input, en vez de reprocesarse. El marcador de caché separa el documento, que es estable, del historial y la pregunta, que son nuevos cada turno."
    >
      <Turno
        y={24}
        etiqueta="turno 1"
        anchoDoc={anchoDoc}
        estado="se escribe en caché"
        destacado={false}
      />
      <Turno
        y={88}
        etiqueta="turno 2"
        anchoDoc={anchoDoc}
        estado="se lee de caché · ~10% del coste"
        destacado
      />

      {/* El marcador que parte el prefijo cacheable del resto */}
      <g className="text-muted">
        <line
          x1={X0 + anchoDoc}
          x2={X0 + anchoDoc}
          y1={14}
          y2={146}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        {/* Termina EN el marcador en vez de empezar en él: a la derecha solo quedan 4 px. */}
        <text
          x={X0 + anchoDoc - 6}
          y={12}
          textAnchor="end"
          className="fill-current font-mono text-[9px]"
        >
          CachePoint()
        </text>

        {/* El rótulo del tramo de la pregunta, con guía: el tramo es demasiado estrecho para
            llevar su nombre dentro, y ensancharlo falsearía la proporción. */}
        <path
          d={`M${X0 + ANCHO + 2} 78 H${X0 + ANCHO + 18}`}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
        />
        <text x={X0 + ANCHO + 22} y={74} className="fill-current text-[9px]">
          la pregunta
        </text>
        <text x={X0 + ANCHO + 22} y={86} className="fill-current text-[9px] opacity-70">
          y el historial
        </text>
      </g>
    </svg>
  );
}

function Turno({
  y,
  etiqueta,
  anchoDoc,
  estado,
  destacado,
}: {
  y: number;
  etiqueta: string;
  anchoDoc: number;
  estado: string;
  destacado: boolean;
}) {
  return (
    <g className={destacado ? "text-accent" : "text-foreground-secondary"}>
      <text x={4} y={y + 24} className="fill-current text-[11px]">
        {etiqueta}
      </text>

      {/* El documento */}
      <rect
        x={X0}
        y={y}
        width={anchoDoc}
        height={34}
        rx={4}
        fill={destacado ? "currentColor" : "none"}
        fillOpacity={destacado ? 0.12 : 0}
        stroke="currentColor"
        strokeWidth={destacado ? 1.5 : 1.25}
      />
      <text x={X0 + 12} y={y + 15} className="fill-current text-[10px]">
        el documento, entero
      </text>
      <text x={X0 + 12} y={y + 28} className="fill-current font-mono text-[9px] opacity-75">
        {DOC} tokens
      </text>
      <text x={X0 + anchoDoc - 12} y={y + 22} textAnchor="end" className="fill-current text-[9px]">
        {estado}
      </text>

      {/* La pregunta y el historial: lo único nuevo */}
      <rect
        x={X0 + anchoDoc + 4}
        y={y}
        width={ANCHO - anchoDoc - 4}
        height={34}
        rx={4}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.6"
      />
    </g>
  );
}
