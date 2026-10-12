/**
 * Formato de números para MOSTRAR (tablas, ejes, etiquetas). Solo presentación: nunca cambia el
 * valor que llegó por el contrato, solo cómo se escribe.
 *
 * Convención en español: coma decimal y punto de miles ("74,2", "12.345"). Los números de cuatro
 * cifras no llevan separador ("2025"), así un año no se lee como "2.025".
 */
const LOCALE = "es";
/** Tope de decimales: suficiente para datos reales y deja fuera el ruido de coma flotante. */
const MAX_DECIMALS = 6;

/** Cuántos decimales trae un número tal como llegó (0 para enteros), con tope `MAX_DECIMALS`. */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // toFixed + recorte de ceros evita la notación exponencial de String() en valores muy chicos.
  const fixed = value.toFixed(MAX_DECIMALS).replace(/0+$/, "");
  const dot = fixed.indexOf(".");
  return dot === -1 ? 0 : fixed.length - dot - 1;
}

/**
 * Decimales con que debe escribirse una columna o serie: los del valor que MÁS trae. Así todos
 * los números se alinean ("74,2" y "61,0") sin redondear ninguno.
 */
export function columnDecimals(values: number[]): number {
  return values.reduce((max, v) => Math.max(max, decimalsOf(v)), 0);
}

/**
 * Escribe un número en español. Con `decimals` usa exactamente esa cantidad (para alinear una
 * columna); sin él, los que el número traiga.
 */
export function formatNumber(value: number, decimals?: number): string {
  if (!Number.isFinite(value)) return String(value);
  const digits = Math.min(MAX_DECIMALS, decimals ?? decimalsOf(value));
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
