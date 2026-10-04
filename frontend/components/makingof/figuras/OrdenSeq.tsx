/**
 * El mismo puñado de eventos, leído de dos maneras.
 *
 * **Es un bug que no se entiende sin verlo.** El contador volvía a cero al recargar la pestaña,
 * así que una sesión tenía dos eventos con el número 0, dos con el 1, y así. Ordenar por ese
 * número mete los eventos de después de la recarga ENTRE los de antes, y el exportador acaba
 * llamando «primera pregunta» a una que no lo es.
 *
 * La fila de arriba es el reloj, que es la verdad de terreno. La de abajo es lo que salía al
 * ordenar por contador. La pregunta que cada lectura elige va marcada, y son distintas.
 */
const EVENTOS = [
  { s: 0, seq: 0, nombre: "inicio", preg: false },
  { s: 30, seq: 5, nombre: "pregunta", preg: true },
  { s: 50, seq: 0, nombre: "inicio (tras recargar)", preg: false },
  { s: 70, seq: 1, nombre: "pregunta", preg: true },
];

const X0 = 128;
const X1 = 560;
const S_MAX = 78;
const px = (s: number) => X0 + (s / S_MAX) * (X1 - X0);

export function OrdenSeq() {
  // Por contador, con el índice como desempate estable: así salía antes del arreglo.
  const porSeq = EVENTOS.map((e, i) => ({ ...e, i })).sort((a, b) => a.seq - b.seq || a.i - b.i);
  const primeraPorTiempo = EVENTOS.find((e) => e.preg);
  const primeraPorSeq = porSeq.find((e) => e.preg);

  return (
    <svg
      viewBox="0 0 620 186"
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Una sesión con una recarga en medio. Por reloj, los eventos van: inicio a los 0 segundos, una pregunta a los 30, un segundo inicio a los 50 tras recargar, y otra pregunta a los 70. El contador volvía a cero al recargar, así que ordenar por contador pone la pregunta de los 70 segundos antes que la de los 30, y el exportador medía 70.000 milisegundos hasta la primera pregunta en vez de 30.000."
    >
      {/* Por reloj */}
      <text x={4} y={34} className="fill-current text-[10px] text-foreground">
        por el reloj
      </text>
      <text x={4} y={47} className="fill-current text-[9px] text-muted">
        la verdad de terreno
      </text>
      <g className="text-foreground-secondary">
        <line x1={X0} x2={X1} y1={40} y2={40} stroke="currentColor" strokeWidth="1" opacity="0.3" />
        {EVENTOS.map((e) => (
          <g key={`t${e.s}`} className={e === primeraPorTiempo ? "text-accent" : ""}>
            <circle cx={px(e.s)} cy={40} r={e === primeraPorTiempo ? 5 : 3.5} fill="currentColor" />
            <text x={px(e.s)} y={26} textAnchor="middle" className="fill-current text-[9px]">
              {e.nombre}
            </text>
            <text
              x={px(e.s)}
              y={56}
              textAnchor="middle"
              className="fill-current font-mono text-[9px] opacity-70"
            >
              {e.s}s · seq {e.seq}
            </text>
          </g>
        ))}
      </g>

      {/* La recarga, marcada SOLO en la fila del reloj: es un instante, y la fila de abajo no es
          un eje de tiempo. Bajándola hasta allí cruzaba una etiqueta y sugería una coincidencia
          temporal que no existe. */}
      <g className="text-muted">
        <line
          x1={px(40)}
          x2={px(40)}
          y1={14}
          y2={62}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity="0.6"
        />
        <text x={px(40)} y={76} textAnchor="middle" className="fill-current text-[9px]">
          aquí se recarga la pestaña, y el contador vuelve a 0
        </text>
      </g>

      {/* Por contador */}
      <text x={4} y={112} className="fill-current text-[10px] text-foreground">
        por el contador
      </text>
      <text x={4} y={125} className="fill-current text-[9px] text-warning">
        lo que hacía el exportador
      </text>
      <g className="text-warning">
        <line x1={X0} x2={X1} y1={118} y2={118} stroke="currentColor" strokeWidth="1" opacity="0.3" />
        {porSeq.map((e, i) => {
          const x = X0 + 36 + i * 108;
          return (
            <g key={`s${e.s}`} className={e === primeraPorSeq ? "" : "text-foreground-secondary"}>
              <circle cx={x} cy={118} r={e === primeraPorSeq ? 5 : 3.5} fill="currentColor" />
              <text
                x={x}
                y={136}
                textAnchor="middle"
                className="fill-current font-mono text-[9px] opacity-70"
              >
                seq {e.seq} · {e.s}s
              </text>
            </g>
          );
        })}
      </g>

      {/* El veredicto de cada lectura */}
      <text x={X1 + 4} y={44} className="fill-current text-[9px] text-accent">
        30.000 ms
      </text>
      <text x={X1 + 4} y={122} className="fill-current text-[9px] text-warning">
        70.000 ms
      </text>
    </svg>
  );
}
