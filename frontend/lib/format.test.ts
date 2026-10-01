import { describe, expect, it } from "vitest";
import { columnDecimals, decimalsOf, formatNumber } from "./format";

describe("decimalsOf", () => {
  it("cuenta los decimales que trae el número", () => {
    expect(decimalsOf(61)).toBe(0);
    expect(decimalsOf(74.2)).toBe(1);
    expect(decimalsOf(0.125)).toBe(3);
    expect(decimalsOf(-3.5)).toBe(1);
  });

  it("no se deja engañar por el ruido de coma flotante ni por valores muy pequeños", () => {
    expect(decimalsOf(0.1 + 0.2)).toBe(1); // 0.30000000000000004
    expect(decimalsOf(1e-7)).toBe(0); // por debajo del tope: se trata como 0
    expect(decimalsOf(Number.NaN)).toBe(0);
  });
});

describe("columnDecimals", () => {
  it("toma los decimales del valor que más trae", () => {
    expect(columnDecimals([74.2, 61, 58.95])).toBe(2);
    expect(columnDecimals([48, 51])).toBe(0);
    expect(columnDecimals([])).toBe(0);
  });
});

describe("formatNumber", () => {
  it("usa coma decimal", () => {
    expect(formatNumber(74.2)).toBe("74,2");
    expect(formatNumber(-3.5)).toBe("-3,5");
  });

  it("alinea una columna sin redondear ningún valor", () => {
    const column = [74.2, 61, 58.95];
    const decimals = columnDecimals(column);
    expect(column.map((v) => formatNumber(v, decimals))).toEqual(["74,20", "61,00", "58,95"]);
  });

  it("separa miles con punto, pero no parte un año", () => {
    expect(formatNumber(12345)).toBe("12.345");
    expect(formatNumber(2025)).toBe("2025");
  });

  it("deja pasar los no finitos sin romper", () => {
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("Infinity");
  });
});
