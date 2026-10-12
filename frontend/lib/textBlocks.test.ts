import { describe, expect, it } from "vitest";
import { parseTextBlocks } from "./textBlocks";

describe("parseTextBlocks", () => {
  it("separa párrafos por línea en blanco", () => {
    expect(parseTextBlocks("Uno.\n\nDos.")).toEqual([
      { kind: "paragraph", text: "Uno." },
      { kind: "paragraph", text: "Dos." },
    ]);
  });

  it("une los saltos simples de un párrafo (como hacía el render anterior)", () => {
    expect(parseTextBlocks("Primera línea\nsegunda línea")).toEqual([
      { kind: "paragraph", text: "Primera línea segunda línea" },
    ]);
  });

  it("reconoce una lista con guiones", () => {
    expect(parseTextBlocks("- A\n- B\n• C")).toEqual([
      { kind: "list", ordered: false, items: ["A", "B", "C"] },
    ]);
  });

  it("reconoce una lista numerada", () => {
    expect(parseTextBlocks("1. Diseño\n2) Aplicación")).toEqual([
      { kind: "list", ordered: true, items: ["Diseño", "Aplicación"] },
    ]);
  });

  it("admite una frase introductoria antes de la lista", () => {
    expect(parseTextBlocks("Se midió:\n- Retención\n- Carga")).toEqual([
      { kind: "paragraph", text: "Se midió:" },
      { kind: "list", ordered: false, items: ["Retención", "Carga"] },
    ]);
  });

  it("no inventa listas: un guion suelto o prosa mezclada queda como párrafo", () => {
    expect(parseTextBlocks("- solo uno")).toEqual([{ kind: "paragraph", text: "- solo uno" }]);
    expect(parseTextBlocks("- A\ntexto normal\n- B")).toEqual([
      { kind: "paragraph", text: "- A texto normal - B" },
    ]);
    expect(parseTextBlocks("En 2020. La cifra bajó\n3. veces")).toEqual([
      { kind: "paragraph", text: "En 2020. La cifra bajó 3. veces" },
    ]);
  });

  it("ignora bloques vacíos", () => {
    expect(parseTextBlocks("\n\n  \n\nHola\n\n")).toEqual([{ kind: "paragraph", text: "Hola" }]);
  });
});
