/**
 * Cuatro tandas de seis imágenes, y cuál arregló el problema.
 *
 * **Seis casillas por fila, y la casilla llena es un fallo.** Puesto así se ve de un vistazo lo que
 * una tabla de proporciones obliga a comparar a mano: que las dos primeras filas son idénticas (o
 * sea que reformular la instrucción, con cinco cambios razonados a la vez, no movió la tasa) y que
 * lo que la movió fue cambiar de proveedor y después apretar la regla.
 *
 * La tercera fila lleva su propia nota porque esconde la parte incómoda: ese 1 de 6 era 0 de 6
 * hasta que el criterio se endureció. El dibujo no la suaviza.
 */
const TANDAS = [
  { etiqueta: "A · Ideogram, prompt original", fallos: 3, nota: "" },
  { etiqueta: "B · Ideogram, prompt mejorado", fallos: 3, nota: "cinco cambios, la misma tasa" },
  { etiqueta: "Gemini, el mismo prompt B", fallos: 1, nota: "era 0 de 6 antes de apretar la regla" },
  { etiqueta: "Gemini, regla endurecida", fallos: 0, nota: "lo que quedó en producción" },
];

const CASILLA = 19;
const HUECO = 5;
const X_CASILLAS = 246;
const ALTO_FILA = 38;

export function TandasImagen() {
  return (
    <svg
      viewBox={`0 0 620 ${TANDAS.length * ALTO_FILA + 26}`}
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Cuatro tandas de seis imágenes cada una, contando cuántas salieron con marcas que remiten a información ausente. Con Ideogram y el prompt original, tres de seis. Con Ideogram y el prompt mejorado, también tres de seis: cinco cambios razonados no movieron la tasa. Con Gemini y el mismo prompt mejorado, una de seis, que eran cero antes de endurecer el criterio. Con Gemini y la regla endurecida, cero de seis."
    >
      <text x={4} y={12} className="fill-current text-[10px] text-muted">
        seis imágenes por tanda · la casilla llena salió con marcas huérfanas
      </text>

      {TANDAS.map((t, fila) => {
        const y = 24 + fila * ALTO_FILA;
        const limpia = t.fallos === 0;
        return (
          <g key={t.etiqueta} className={limpia ? "text-accent" : "text-foreground-secondary"}>
            <text x={4} y={y + 14} className="fill-current text-[10px]">
              {t.etiqueta}
            </text>

            {Array.from({ length: 6 }, (_, i) => {
              const fallo = i < t.fallos;
              return (
                <rect
                  key={i}
                  x={X_CASILLAS + i * (CASILLA + HUECO)}
                  y={y + 2}
                  width={CASILLA}
                  height={CASILLA}
                  rx={3}
                  className={fallo ? "fill-warning" : "fill-none"}
                  fillOpacity={fallo ? 0.9 : 0}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeOpacity={fallo ? 0 : 0.5}
                />
              );
            })}

            <text
              x={X_CASILLAS + 6 * (CASILLA + HUECO) + 6}
              y={y + 15}
              className="fill-current font-mono text-[10px]"
            >
              {t.fallos}/6
            </text>

            {t.nota ? (
              <text x={4} y={y + 27} className="fill-current text-[9px] opacity-70">
                {t.nota}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
