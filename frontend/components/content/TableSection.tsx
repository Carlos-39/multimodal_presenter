import type { TableContent } from "@/lib/types";

export function TableSection({ content }: { content: TableContent }) {
  // Una columna es numérica si todas sus celdas lo son → números en mono, alineados a la derecha.
  const numericCols = content.columns.map((_, c) =>
    content.rows.every((row) => typeof row[c] === "number"),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {content.columns.map((col, i) => (
              <th
                key={i}
                className={`px-3 py-2 font-medium text-muted ${
                  numericCols[i] ? "text-right" : "text-left"
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, r) => (
            <tr key={r} className="border-b border-border/60 last:border-0">
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={`px-3 py-2 text-foreground ${
                    numericCols[c] ? "tabular text-right" : "text-left"
                  }`}
                >
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
