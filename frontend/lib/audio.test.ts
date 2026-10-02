import { describe, expect, it } from "vitest";
import { formatTimestamp, sourceKindOf } from "./audio";

function file(type: string): File {
  return new File([new Uint8Array([0])], "fuente", { type });
}

describe("sourceKindOf", () => {
  it("sin archivo es una fuente de texto", () => {
    expect(sourceKindOf(null)).toBe("text");
  });

  it("reconoce el PDF", () => {
    expect(sourceKindOf(file("application/pdf"))).toBe("pdf");
  });

  it("reconoce el audio por su familia de tipo, no por una lista fija", () => {
    expect(sourceKindOf(file("audio/mpeg"))).toBe("audio");
    expect(sourceKindOf(file("audio/wav"))).toBe("audio");
    expect(sourceKindOf(file("audio/flac"))).toBe("audio");
  });

  it("cualquier otro binario cae en imagen", () => {
    expect(sourceKindOf(file("image/png"))).toBe("image");
    expect(sourceKindOf(file("image/webp"))).toBe("image");
  });
});

describe("formatTimestamp", () => {
  it("formatea segundos como m:ss con dos dígitos", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(7)).toBe("0:07");
    expect(formatTimestamp(62)).toBe("1:02");
    expect(formatTimestamp(600)).toBe("10:00");
  });

  it("trunca los decimales (los tiempos del modelo son aproximados)", () => {
    expect(formatTimestamp(9.8)).toBe("0:09");
  });

  it("no produce tiempos negativos", () => {
    expect(formatTimestamp(-3)).toBe("0:00");
  });
});
