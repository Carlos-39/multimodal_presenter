import { describe, expect, it } from "vitest";
// Ruta relativa, no `@/`: no hay config de vitest, así que el alias solo existe para Next.
import { CAPITULOS } from "../content/makingOf";
import { columnasDeDatos, escrito, trozos } from "./makingOf";

describe("trozos", () => {
  it("una línea sin marcas es un solo trozo", () => {
    expect(trozos("Nunca aplanar la fuente.")).toEqual([
      { clase: "texto", texto: "Nunca aplanar la fuente." },
    ]);
  });

  it("reconoce las tres marcas y conserva lo que hay entre ellas", () => {
    expect(trozos("Costó ==$0,017 por minuto== con **Gemini** vía `perception.py`.")).toEqual([
      { clase: "texto", texto: "Costó " },
      { clase: "marca", texto: "$0,017 por minuto" },
      { clase: "texto", texto: " con " },
      { clase: "fuerte", texto: "Gemini" },
      { clase: "texto", texto: " vía " },
      { clase: "codigo", texto: "perception.py" },
      { clase: "texto", texto: "." },
    ]);
  });

  it("no se come el texto: recomponer los trozos devuelve la línea", () => {
    // Es la propiedad que de verdad importa. Un parser que pierda una palabra del Registro
    // rompería lo único que este documento promete: contar lo que pasó.
    const linea = "**La información** no se degrada al aplanar: ==se pierde==.";
    const recompuesto = trozos(linea)
      .map((t) => t.texto)
      .join("");
    expect(recompuesto).toBe("La información no se degrada al aplanar: se pierde.");
  });

  it("una marca sin cerrar se queda como texto, no rompe la línea", () => {
    expect(trozos("un ** asterisco suelto")).toEqual([
      { clase: "texto", texto: "un ** asterisco suelto" },
    ]);
  });
});

describe("el índice", () => {
  it("los slugs son únicos", () => {
    // El slug es la ruta. Dos iguales harían que un capítulo tapara al otro en silencio.
    const slugs = CAPITULOS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("la numeración es correlativa desde 1", () => {
    expect(CAPITULOS.map((c) => c.numero)).toEqual(CAPITULOS.map((_, i) => i + 1));
  });

  it("todos los capítulos tienen su conclusión en una línea", () => {
    // El índice ES la versión corta: un capítulo sin conclusión dejaría un hueco justo ahí.
    for (const c of CAPITULOS) {
      expect(c.conclusion.length).toBeGreaterThan(20);
      expect(c.conclusion).not.toContain("\n");
    }
  });

  it("hay al menos un capítulo escrito", () => {
    expect(CAPITULOS.filter(escrito).length).toBeGreaterThan(0);
  });
});

describe("columnasDeDatos", () => {
  it("una columna de cifras es de datos, una de prosa no", () => {
    const filas = [
      ["Turno 1", "3253", "escribe la caché"],
      ["Turno 2", "3298", "lee la caché"],
    ];
    expect(columnasDeDatos(filas, 3)).toEqual([false, true, false]);
  });

  it("reconoce proporciones, porcentajes y decimales", () => {
    const filas = [
      ["Plana", "3/3", "0/1", "12 %", "1,98"],
      ["Anotada", "3/3", "1/1", "15 %", "2,04"],
    ];
    expect(columnasDeDatos(filas, 5)).toEqual([false, true, true, true, true]);
  });

  it("basta una celda de prosa para que la columna entera sea prosa", () => {
    // Mezclar dos composiciones dentro de una columna sería peor que no distinguirlas.
    const filas = [["a", "415"], ["b", "sin tope"]];
    expect(columnasDeDatos(filas, 2)).toEqual([false, false]);
  });

  it("las celdas vacías no cuentan, pero una columna entera vacía no es de datos", () => {
    expect(columnasDeDatos([["a", ""], ["b", "7"]], 2)).toEqual([false, true]);
    expect(columnasDeDatos([["a", ""], ["b", ""]], 2)).toEqual([false, false]);
  });
});
