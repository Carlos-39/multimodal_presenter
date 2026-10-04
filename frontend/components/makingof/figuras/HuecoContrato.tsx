/**
 * El hueco del prototipo, y por qué ya no se puede escribir.
 *
 * **Lo que la figura tiene que hacer ver es que la diferencia no es una validación añadida, sino
 * una forma distinta.** A la izquierda dos campos hermanos que nada obliga a coincidir; a la
 * derecha un solo objeto donde el tipo y el contenido son la misma cosa. Por eso el dibujo de la
 * derecha tiene una caja menos, no una más: cerrar el hueco quitó una pieza.
 *
 * El acento se reserva a lo que cambia. La grieta va en el rojo de error porque es un error.
 */
export function HuecoContrato() {
  return (
    <svg
      viewBox="0 0 620 200"
      className="h-auto w-full min-w-[520px]"
      role="img"
      aria-label="Antes, una sección tenía dos campos independientes, content_type y content, que podían contradecirse: declarar un gráfico y guardar una cadena de texto pasaba la validación. Ahora el discriminador vive dentro del propio bloque de contenido, así que el tipo declarado y el contenido real son el mismo objeto y no pueden desalinearse."
    >
      <text x={4} y={14} className="fill-current text-[11px] text-muted">
        antes · el prototipo
      </text>
      <text x={330} y={14} className="fill-current text-[11px] text-accent">
        ahora · el contrato
      </text>

      {/* Izquierda: dos campos hermanos que nada obliga a coincidir */}
      <g className="text-muted">
        <rect
          x={4}
          y={26}
          width={282}
          height={150}
          rx={8}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeDasharray="3 3"
        />
        <text x={18} y={46} className="fill-current text-[10px]">
          Section
        </text>

        <Campo x={22} y={60} ancho={246} clave="content_type" valor='"chart"' />
        <Campo x={22} y={116} ancho={246} clave="content" valor='"hola"' />

        {/* La grieta: lo que falta entre los dos campos */}
        {/* `warning` y no un rojo nuevo: es el token que la aplicación ya usa para lo que va mal,
            y la figura no es sitio para inventar un color que no existe en el sistema. */}
        <g className="text-warning">
          <path
            d="M145 92 l-9 14 h11 l-9 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="trazo"
            style={{ ["--largo" as string]: 45, animationDelay: "0.35s" }}
          />
          <text x={162} y={108} className="fill-current text-[10px]">
            nada los obliga a coincidir
          </text>
        </g>
      </g>

      {/* Derecha: un solo objeto, el discriminador dentro */}
      <g className="text-accent">
        <rect
          x={330}
          y={26}
          width={286}
          height={150}
          rx={8}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <text x={344} y={46} className="fill-current text-[10px]">
          Section
        </text>

        <rect
          x={348}
          y={56}
          width={250}
          height={102}
          rx={6}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <text x={362} y={74} className="fill-current text-[10px] opacity-75">
          content
        </text>
        <Campo x={362} y={84} ancho={222} clave="content_type" valor='"chart"' tinta />
        <Campo x={362} y={122} ancho={222} clave="data" valor="ChartData" tinta />
      </g>

      <text x={330} y={192} className="fill-current text-[10px] text-muted">
        el tipo y el contenido son el mismo objeto
      </text>
    </svg>
  );
}

function Campo({
  x,
  y,
  ancho,
  clave,
  valor,
  tinta = false,
}: {
  x: number;
  y: number;
  ancho: number;
  clave: string;
  valor: string;
  tinta?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={ancho}
        height={30}
        rx={5}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity={tinta ? 0.85 : 0.6}
      />
      <text x={x + 12} y={y + 19} className="fill-current font-mono text-[10px]">
        {clave}
      </text>
      <text
        x={x + ancho - 12}
        y={y + 19}
        textAnchor="end"
        className="fill-current font-mono text-[10px] opacity-70"
      >
        {valor}
      </text>
    </g>
  );
}
