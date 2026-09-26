import { describe, expect, it } from "vitest";
import { highlightSegments } from "./highlight";

describe("highlightSegments", () => {
  it("resalta el rango exacto", () => {
    expect(highlightSegments("hola mundo", 5, 10)).toEqual({
      before: "hola ",
      mark: "mundo",
      after: "",
    });
  });

  it("sin offsets no resalta (texto completo en 'before')", () => {
    expect(highlightSegments("hola mundo", null, null)).toEqual({
      before: "hola mundo",
      mark: "",
      after: "",
    });
  });

  it("rango vacío (end <= start) no resalta", () => {
    expect(highlightSegments("hola", 2, 2)).toEqual({ before: "hola", mark: "", after: "" });
  });

  it("clampa offsets fuera de rango", () => {
    expect(highlightSegments("hola", 2, 999)).toEqual({ before: "ho", mark: "la", after: "" });
  });

  it("preserva el texto: before + mark + after == original", () => {
    const t = "El crecimiento fue sostenido durante el periodo.";
    const s = highlightSegments(t, 3, 15);
    expect(s.before + s.mark + s.after).toBe(t);
  });
});
