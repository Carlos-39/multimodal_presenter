/**
 * Los cuatro niveles de fidelidad, en orden de fuerza decreciente.
 *
 * **Es una escalera que baja, no una lista.** Cuatro entradas puestas en fila se leerían como
 * cuatro opciones equivalentes; escalonadas hacia abajo se lee lo que de verdad pasa: cada
 * formato devuelve una prueba más débil que el anterior, y el último no devuelve ninguna.
 *
 * Solo el primer peldaño lleva el resaltador, porque es el único donde la palabra «comprobada» es
 * literal. Que los otros tres NO lo lleven es la mitad del mensaje: el amarillo significa lo
 * mismo aquí que en la aplicación, y no se regala.
 */
const PELDANOS = [
  {
    entra: "un texto",
    estado: "verified",
    vuelve: "la cita, comparada carácter por carácter",
    verificada: true,
  },
  {
    entra: "un PDF con texto",
    estado: "unverified",
    vuelve: "la página, y un recuadro sobre la frase",
    verificada: false,
  },
  {
    entra: "una grabación",
    estado: "unverified",
    vuelve: "el segundo exacto, y quién lo dijo",
    verificada: false,
  },
  {
    entra: "una imagen",
    estado: "unverified",
    vuelve: "la cita, y ningún sitio al que ir",
    verificada: false,
  },
];

const ALTO = 46;
const SANGRIA = 26;

export function EscaleraFidelidad() {
  return (
    <svg
      viewBox={`0 0 620 ${PELDANOS.length * ALTO + 38}`}
      className="h-auto w-full min-w-[520px]"
      role="img"
      aria-label="Cuatro niveles de atribución en orden de fuerza decreciente. Un texto devuelve la cita comparada carácter por carácter, y es el único estado verificado. Un PDF con texto devuelve la página y un recuadro sobre la frase. Una grabación devuelve el segundo exacto y quién lo dijo. Una imagen devuelve la cita y ningún sitio al que ir. Los tres últimos comparten el estado no verificado."
    >
      <text x={4} y={14} className="fill-current text-[10px] text-muted">
        más fuerte
      </text>
      <text x={616} y={PELDANOS.length * ALTO + 32} textAnchor="end" className="fill-current text-[10px] text-muted">
        más débil
      </text>

      {PELDANOS.map((p, i) => {
        const x = 4 + i * SANGRIA;
        const y = 24 + i * ALTO;
        return (
          <g key={p.entra} className={p.verificada ? "text-foreground" : "text-foreground-secondary"}>
            {/* El escalón que baja: se traza al llegar, así se ve el descenso en orden. */}
            {i > 0 ? (
              <path
                d={`M${x - SANGRIA + 10} ${y - ALTO + 36} V${y + 6} H${x}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.4"
                className="trazo"
                style={{ ["--largo" as string]: 70, animationDelay: `${i * 0.18}s` }}
              />
            ) : null}

            <rect
              x={x}
              y={y}
              width={616 - x}
              height={34}
              rx={5}
              fill="none"
              stroke="currentColor"
              strokeWidth={p.verificada ? 1.5 : 1}
              opacity={p.verificada ? 1 : 0.55}
            />

            <text x={x + 14} y={y + 21} className="fill-current text-[11px]">
              {p.entra}
            </text>

            {p.verificada ? (
              <>
                <rect
                  x={x + 118}
                  y={y + 9}
                  width={62}
                  height={16}
                  rx={3}
                  className="fill-highlight"
                />
                <text x={x + 149} y={y + 21} textAnchor="middle" className="fill-current font-mono text-[9px]">
                  {p.estado}
                </text>
              </>
            ) : (
              <text x={x + 118} y={y + 21} className="fill-current font-mono text-[9px] opacity-60">
                {p.estado}
              </text>
            )}

            <text x={616 - 14} y={y + 21} textAnchor="end" className="fill-current text-[10px] opacity-80">
              {p.vuelve}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
