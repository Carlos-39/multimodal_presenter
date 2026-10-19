"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { columnDecimals, formatNumber } from "@/lib/format";
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
const MARGIN = { top: 20, right: 8, bottom: 0, left: 0 } as const;
const ANIMATION_MS = 400;
// Con pocas marcas, el valor se escribe sobre cada una (no hay que ir a leerlo al eje).
const MAX_LABELED_MARKS = 10;
// Una línea con pocos puntos los marca; con muchos, los puntos estorban.
const MAX_DOTTED_POINTS = 12;

// Números en monoespaciada tabular (señal de "herramienta de datos"); los nombres de categoría
// son texto, así que van en la sans de la interfaz.
const NUMBER_TICK = { fontFamily: "var(--font-geist-mono)", fontSize: 12, fill: AXIS } as const;
const NAME_TICK = { fontSize: 12, fill: AXIS } as const;
const VALUE_LABEL = {
  fontFamily: "var(--font-geist-mono)",
  fontSize: 11,
  fill: "var(--foreground-secondary)",
} as const;

const formatValue = (value: unknown) =>
  typeof value === "number" ? formatNumber(value) : String(value ?? "");

// Chrome del gráfico (tooltip, leyenda) con los tokens del sistema: sigue al tema claro/oscuro.
const TOOLTIP = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    boxShadow: "var(--elevation-float)",
    fontSize: 12,
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--muted)", marginBottom: 2 },
  itemStyle: { color: "var(--foreground)", fontFamily: "var(--font-geist-mono)" },
  cursor: { fill: "var(--surface-sunken)", stroke: "var(--border)" },
  formatter: formatValue,
} as const;
const LEGEND = {
  itemSorter: null, // mismo orden que las series (no alfabético)
  iconSize: 10,
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
  formatter: (value: string) => <span style={{ color: "var(--foreground-secondary)" }}>{value}</span>,
} as const;

/**
 * Render de gráficos con Recharts. Renderiza lo que llega: el TIPO ya viene decidido por la regla
 * determinista de isomorfismo del backend (Hito 5a); aquí solo se cuida la lectura, números en
 * español, valores a la vista cuando caben, y nada que compita con los datos.
 */
// SSR-safe: false en el servidor, true en el cliente, sin setState en un efecto.
const subscribe = () => () => {};

export function ChartSection({ content }: { content: ChartContent }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const reducedMotion = usePrefersReducedMotion();

  // Evita medir con ancho 0 durante el SSR/hidratación.
  if (!mounted) {
    return <div style={{ height: HEIGHT }} className="skeleton rounded-md" aria-hidden />;
  }

  const { chart_type, data } = content;
  const motion = { isAnimationActive: !reducedMotion, animationDuration: ANIMATION_MS } as const;
  // Con una sola serie la leyenda solo repetiría su nombre: se omite (va como pie del gráfico).
  const showLegend = data.series.length > 1;
  const showValues = data.categories.length * data.series.length <= MAX_LABELED_MARKS;

  // Datos categóricos → filas para line/bar.
  const rows = data.categories.map((category, i) => {
    const row: Record<string, string | number> = { name: category };
    for (const series of data.series) row[series.name] = series.values[i] ?? 0;
    return row;
  });

  // Etiqueta de valor de una serie: todos sus números con los mismos decimales, sin redondear.
  const valueLabel = (values: number[]) => {
    const decimals = columnDecimals(values);
    return (value: unknown) => (typeof value === "number" ? formatNumber(value, decimals) : "");
  };

  let chart: React.ReactElement;
  switch (chart_type) {
    case "line":
      chart = (
        <LineChart data={rows} margin={MARGIN}>
          <CartesianGrid stroke={GRID} vertical={false} />
          {/* Aire a los lados: el primer y el último punto (y su valor) no quedan contra el borde. */}
          <XAxis
            dataKey="name"
            stroke={AXIS}
            tick={NAME_TICK}
            tickLine={false}
            padding={{ left: 28, right: 28 }}
          />
          <YAxis tick={NUMBER_TICK} tickFormatter={formatValue} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} />
          {showLegend ? <Legend {...LEGEND} /> : null}
          {data.series.map((s, i) => {
            const color = PALETTE[i % PALETTE.length];
            return (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={color}
                strokeWidth={2}
                dot={
                  data.categories.length <= MAX_DOTTED_POINTS
                    ? { r: 3, strokeWidth: 0, fill: color }
                    : false
                }
                activeDot={{ r: 4 }}
                {...motion}
              >
                {showValues ? (
                  <LabelList
                    dataKey={s.name}
                    position="top"
                    offset={8}
                    formatter={valueLabel(s.values)}
                    {...VALUE_LABEL}
                  />
                ) : null}
              </Line>
            );
          })}
        </LineChart>
      );
      break;
    case "bar":
      chart = (
        <BarChart data={rows} margin={MARGIN} barCategoryGap="28%" barGap={4}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="name" stroke={AXIS} tick={NAME_TICK} tickLine={false} />
          <YAxis tick={NUMBER_TICK} tickFormatter={formatValue} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} />
          {showLegend ? <Legend {...LEGEND} /> : null}
          {data.series.map((s, i) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={PALETTE[i % PALETTE.length]}
              maxBarSize={64}
              radius={[3, 3, 0, 0]}
              {...motion}
            >
              {showValues ? (
                <LabelList
                  dataKey={s.name}
                  position="top"
                  offset={6}
                  formatter={valueLabel(s.values)}
                  {...VALUE_LABEL}
                />
              ) : null}
            </Bar>
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
          {/* Anillo con separación entre porciones: se distinguen por forma además de por color. */}
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={56}
            outerRadius={100}
            stroke="var(--table-bg, var(--surface))"
            strokeWidth={2}
            {...motion}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
            {showValues ? (
              <LabelList
                dataKey="value"
                position="outside"
                offset={12}
                stroke="none"
                formatter={valueLabel(pieData.map((d) => d.value))}
                {...VALUE_LABEL}
              />
            ) : null}
          </Pie>
          <Tooltip {...TOOLTIP} />
          <Legend {...LEGEND} />
        </PieChart>
      );
      break;
    }
    case "scatter":
      chart = (
        <ScatterChart margin={MARGIN}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            dataKey="x"
            type="number"
            stroke={AXIS}
            tick={NUMBER_TICK}
            tickFormatter={formatValue}
            tickLine={false}
          />
          <YAxis
            dataKey="y"
            type="number"
            tick={NUMBER_TICK}
            tickFormatter={formatValue}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip {...TOOLTIP} />
          {showLegend ? <Legend {...LEGEND} /> : null}
          {data.series.map((s, i) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={s.values.map((v, idx) => ({ x: idx, y: v }))}
              fill={PALETTE[i % PALETTE.length]}
              {...motion}
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
      {/* Con una sola serie no hay leyenda: su nombre va como pie del gráfico, para no perderlo. */}
      {!showLegend && chart_type !== "pie" && data.series[0] ? (
        <p className="pt-2 text-center text-xs text-muted">{data.series[0].name}</p>
      ) : null}
      {chart_type === "scatter" ? (
        <p className="pt-2 text-xs text-muted">
          Nota: la forma de datos para dispersión (x/y) se refina en un hito posterior
          (isomorfismo). TODO(Hito5)
        </p>
      ) : null}
    </div>
  );
}
