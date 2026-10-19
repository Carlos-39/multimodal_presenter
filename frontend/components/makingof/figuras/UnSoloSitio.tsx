/**
 * Ocho rutas, una sola puerta.
 *
 * **El dibujo existe para enseñar por qué el trabajo resultó ser pequeño.** Parecía que había que
 * tocar ocho endpoints para que una presentación restaurada (que no trae archivo) siguiera
 * funcionando. Medirlo antes de construir mostró que los ocho ya entraban por el mismo sitio, así
 * que el cambio fue una función.
 *
 * El cuello es también donde se impone la propiedad: lo que no pasa por ahí no puede leer un
 * documento guardado. Por eso está dibujado como una puerta y no como un nodo de paso.
 */
const RUTAS = ["/transform", "/transform/stream", "/chat/stream", "/chat/suggestions", "/deck", "/narration", "/illustrations", "/explain-image"];

export function UnSoloSitio() {
  const alto = RUTAS.length * 19 + 16;

  return (
    <svg
      viewBox={`0 0 620 ${alto}`}
      className="h-auto w-full min-w-[540px]"
      role="img"
      aria-label="Las ocho rutas que reciben un documento entran todas por la misma función. Ahí, si no viene archivo pero viene un identificador de documento, se comprueba la propiedad y se cargan los bytes del almacén. Lo que no pasa por esa función no puede leer un documento guardado. La ruta de transcripción queda fuera a propósito, porque graba una pregunta por voz y no un documento."
    >
      <defs>
        <marker id="uss-p" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" className="fill-accent" />
        </marker>
      </defs>

      {/* Las ocho rutas */}
      <g className="text-foreground-secondary">
        {RUTAS.map((r, i) => (
          <text key={r} x={4} y={20 + i * 19} className="fill-current font-mono text-[10px]">
            {r}
          </text>
        ))}
      </g>

      {/* Confluyen en la puerta */}
      <g className="text-accent">
        {RUTAS.map((r, i) => {
          const y = 16 + i * 19;
          const medio = alto / 2;
          return (
            <path
              key={r}
              d={`M146 ${y} C 190 ${y}, 210 ${medio}, 262 ${medio}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.5"
              className="trazo"
              style={{ ["--largo" as string]: 150, animationDelay: `${i * 0.06}s` }}
            />
          );
        })}

        <rect
          x={266}
          y={alto / 2 - 28}
          width={196}
          height={56}
          rx={6}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <text x={364} y={alto / 2 - 8} textAnchor="middle" className="fill-current font-mono text-[10px]">
          parse_document_inputs
        </text>
        <text x={364} y={alto / 2 + 8} textAnchor="middle" className="fill-current text-[9px] opacity-80">
          ¿hay archivo? si no, carga por id
        </text>
        <text x={364} y={alto / 2 + 21} textAnchor="middle" className="fill-current text-[9px] opacity-80">
          tras comprobar la propiedad
        </text>

        <path
          d={`M462 ${alto / 2} H516`}
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#uss-p)"
          className="trazo"
          style={{ ["--largo" as string]: 54, animationDelay: "0.55s" }}
        />
      </g>

      <g className="text-foreground-secondary">
        <rect
          x={520}
          y={alto / 2 - 18}
          width={96}
          height={36}
          rx={5}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <text x={568} y={alto / 2 + 3} textAnchor="middle" className="fill-current text-[10px]">
          los bytes
        </text>
      </g>

      <text x={4} y={alto - 2} className="fill-current text-[9px] text-muted">
        /transcribe queda fuera: graba una pregunta por voz, no un documento
      </text>
    </svg>
  );
}
