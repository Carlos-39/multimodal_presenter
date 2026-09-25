"use client";

import { useEffect, useState } from "react";
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

// Paleta sobria y contenida (anti "look de IA"): tonos apagados, sin colores chillones.
const PALETTE = ["#334155", "#0f766e", "#92600a", "#64748b", "#475569"];
const AXIS = "#71717a";
const GRID = "#e4e4e7";
const HEIGHT = 288;

/**
 * Render de gráficos con Recharts. En este hito renderiza lo que llega; la regla
 * determinista de isomorfismo (qué tipo de gráfico admite cada forma de datos) es Hito 5.
 */
export function ChartSection({ content }: { content: ChartContent }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
          <XAxis dataKey="name" stroke={AXIS} fontSize={12} />
          <YAxis stroke={AXIS} fontSize={12} />
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
          <XAxis dataKey="name" stroke={AXIS} fontSize={12} />
          <YAxis stroke={AXIS} fontSize={12} />
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
          <XAxis dataKey="x" type="number" stroke={AXIS} fontSize={12} />
          <YAxis dataKey="y" type="number" stroke={AXIS} fontSize={12} />
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
