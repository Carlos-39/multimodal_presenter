import { columnDecimals, formatNumber } from "@/lib/format";
import type { TableContent } from "@/lib/types";

// A partir de este número de filas la tabla tiene su propio desplazamiento vertical, con el
// encabezado fijo: se puede recorrer sin perder de vista qué es cada columna.
const TALL_TABLE_ROWS = 12;

export function TableSection({ content }: { content: TableContent }) {
  // Una columna es numérica si todas sus celdas lo son → números en mono, alineados a la derecha
  // y escritos con los mismos decimales (los del valor que más trae; no se redondea ninguno).
  const numericCols = content.columns.map((_, c) =>
    content.rows.every((row) => typeof row[c] === "number"),
  );
  const decimals = content.columns.map((_, c) =>
    numericCols[c] ? columnDecimals(content.rows.map((row) => row[c] as number)) : 0,
  );
  const tall = content.rows.length > TALL_TABLE_ROWS;

  return (
    // `scroll-hint`: sombras en los bordes hacia donde queda tabla por ver (ancha o larga).
    <div className={`scroll-hint overflow-auto ${tall ? "max-h-[30rem]" : ""}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {content.columns.map((col, i) => (
              <th
                key={i}
                className={`border-b border-border-strong px-3 py-2 text-[0.8125rem] font-medium text-muted ${
                  numericCols[i] ? "text-right" : "text-left"
                } ${tall ? "sticky top-0 bg-[var(--table-bg,var(--surface))]" : ""}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, r) => (
            <tr key={r} className="border-b border-border last:border-0">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={`px-3 py-2 text-foreground ${
                    numericCols[c] ? "tabular whitespace-nowrap text-right" : "text-left"
                  }`}
                >
                  {typeof cell === "number"
                    ? formatNumber(cell, numericCols[c] ? decimals[c] : undefined)
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
