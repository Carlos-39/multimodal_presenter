"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartContent } from "@/lib/types";

// Paleta categórica validada (CVD-safe, guía dataviz), vía tokens CSS → cambia con el tema.
// Confinada a las marcas de datos; el resto del gráfico usa el chrome neutro.
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];
const AXIS = "var(--chart-muted)";
const GRID = "var(--chart-grid)";
const HEIGHT = 288;
// Ejes/etiquetas en monoespaciada tabular (números como "herramienta de datos").
const TICK = { fontFamily: "var(--font-geist-mono)", fontSize: 12, fill: AXIS } as const;

/**
 * Render de gráficos con Recharts. En este hito renderiza lo que llega; la regla
 * determinista de isomorfismo (qué tipo de gráfico admite cada forma de datos) es Hito 5.
 */
// SSR-safe: false en el servidor, true en el cliente — sin setState en un efecto.
const subscribe = () => () => {};

export function ChartSection({ content }: { content: ChartContent }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  // Evita medir con ancho 0 durante el SSR/hidratación.
  if (!mounted) {
    return (
      <div
        style={{ height: HEIGHT }}
        className="rounded-md border border-border bg-surface"
        aria-hidden
      />
    );
  }

  const { chart_type, data } = content;

  // Datos categóricos → filas para line/bar.
  const rows = data.categories.map((category, i) => {
    const row: Record<string, string | number> = { name: category };
    for (const series of data.series) row[series.name] = series.values[i] ?? 0;
    return row;
  });

  let chart: React.ReactElement;
  switch (chart_type) {
    case "line":
      chart = (
        <LineChart data={rows}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" stroke={AXIS} tick={TICK} />
          <YAxis stroke={AXIS} tick={TICK} />
          <Tooltip />
          <Legend />
          {data.series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={PALETTE[i % PALETTE.length]}
              dot={false}
            />
          ))}
        </LineChart>
      );
      break;
    case "bar":
      chart = (
        <BarChart data={rows}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" stroke={AXIS} tick={TICK} />
          <YAxis stroke={AXIS} tick={TICK} />
          <Tooltip />
          <Legend />
          {data.series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </BarChart>
      );
      break;
    case "pie": {
      const pieData = data.categories.map((category, i) => ({
        name: category,
        value: data.series[0]?.values[i] ?? 0,
      }));
      chart = (
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100}>
            {pieData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      );
      break;
    }
    case "scatter":
      chart = (
        <ScatterChart>
          <CartesianGrid stroke={GRID} />
          <XAxis dataKey="x" type="number" stroke={AXIS} tick={TICK} />
          <YAxis dataKey="y" type="number" stroke={AXIS} tick={TICK} />
          <Tooltip />
          <Legend />
          {data.series.map((s, i) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={s.values.map((v, idx) => ({ x: idx, y: v }))}
              fill={PALETTE[i % PALETTE.length]}
            />
          ))}
        </ScatterChart>
      );
      break;
    default: {
      // Chequeo de exhaustividad: si se añade un ChartType, TypeScript falla aquí.
      const _exhaustive: never = chart_type;
      return <>{_exhaustive}</>;
    }
  }

  return (
    <div className="w-full">
      <div style={{ height: HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
      {chart_type === "scatter" ? (
        <p className="pt-2 text-xs text-muted">
          Nota: la forma de datos para dispersión (x/y) se refina en un hito posterior
          (isomorfismo). TODO(Hito5)
        </p>
      ) : null}
    </div>
  );
}
