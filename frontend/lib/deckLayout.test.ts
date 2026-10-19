import { describe, expect, it } from "vitest";
import { slideLayout } from "./deckLayout";
import type { ChartContent, GeneratedIllustration, SourceReference } from "./types";

const IMAGE: GeneratedIllustration = {
  kind: "generated_illustration",
  image_url: "data:image/png;base64,AA==",
  alt: "a",
  label: "l",
};

const FUENTE: SourceReference = {
  document_id: "doc-1",
  quote: "una frase del documento",
  page: null,
  char_start: 0,
  char_end: 23,
};

const LADOS = {
  izquierda: { titulo: "Rayo", puntos: ["Baja al suelo"] },
  derecha: { titulo: "Duende", puntos: ["Sube a la mesosfera"] },
};

/** Lo mínimo para llamar a `slideLayout`, para no repetirlo en cada caso. */
const base: Parameters<typeof slideLayout>[0] = { bullets: [], illustration: null, source: null };

describe("slideLayout: el papel decide la forma", () => {
  it("una cifra se compone como dato", () => {
    expect(slideLayout({ ...base, papel: "dato", cifra: "80 km" })).toBe("dato");
  });

  it("dos lados se componen como comparación", () => {
    expect(slideLayout({ ...base, papel: "comparacion", comparacion: LADOS })).toBe("comparacion");
  });

  it("una cita se muestra en grande, no en el pie", () => {
    expect(slideLayout({ ...base, papel: "cita", source: FUENTE })).toBe("cita");
  });

  it("la apertura y el cierre son una frase sola", () => {
    expect(slideLayout({ ...base, papel: "apertura" })).toBe("enunciado");
    expect(slideLayout({ ...base, papel: "cierre" })).toBe("enunciado");
  });

  it("la apertura conserva su forma aunque lleve imagen de ambiente", () => {
    expect(slideLayout({ ...base, papel: "apertura", illustration: IMAGE })).toBe("enunciado");
  });
});

describe("slideLayout: el papel no puede prometer lo que la slide no trae", () => {
  /**
   * El modelo declara el papel y rellena los campos por separado, así que puede decir `dato` y no
   * poner cifra. Componer esa diapositiva como un dato dejaría un hueco enorme donde iba el
   * número. Una lámina sosa es mucho mejor que una rota.
   */
  it("un dato sin cifra se cae a la composición de siempre", () => {
    expect(slideLayout({ ...base, papel: "dato", cifra: null })).toBe("afirmacion");
    expect(slideLayout({ ...base, papel: "dato", bullets: ["a"] })).toBe("lista");
  });

  it("una comparación sin los dos lados se cae igual", () => {
    expect(slideLayout({ ...base, papel: "comparacion", comparacion: null })).toBe("afirmacion");
  });

  it("una cita sin fuente se cae igual", () => {
    expect(slideLayout({ ...base, papel: "cita", source: null })).toBe("afirmacion");
  });
});

describe("slideLayout: lo guardado antes del rediseño", () => {
  /**
   * Una presentación de la biblioteca no trae papel. Tiene que componerse como el día que se
   * guardó: abrir algo viejo no debería cambiarle la cara.
   */
  it("sin papel, manda lo que la slide trae", () => {
    expect(slideLayout({ ...base, illustration: IMAGE })).toBe("media");
    expect(slideLayout({ ...base, bullets: ["a", "b"] })).toBe("lista");
    expect(slideLayout(base)).toBe("afirmacion");
  });
});

describe("slideLayout: la evidencia visual", () => {
  const GRAFICO: ChartContent = {
    content_type: "chart",
    chart_type: "bar",
    data: { categories: ["a"], series: [{ name: "s", values: [1] }] },
  };

  it("una afirmación con gráfico se compone como evidencia", () => {
    expect(slideLayout({ ...base, evidencia: GRAFICO })).toBe("evidencia");
  });

  /**
   * Es el orden que define el rediseño. Una lámina puede traer imagen y evidencia a la vez, y
   * entonces manda la evidencia: es lo que sostiene la afirmación, mientras que la imagen
   * acompaña. Lo mismo con las viñetas, que son la forma vieja de sostener algo.
   */
  it("la evidencia manda sobre la imagen y sobre las viñetas", () => {
    expect(slideLayout({ ...base, evidencia: GRAFICO, illustration: IMAGE })).toBe("evidencia");
    expect(slideLayout({ ...base, evidencia: GRAFICO, bullets: ["a"] })).toBe("evidencia");
  });

  it("pero no le gana a un papel que tiene su propia forma", () => {
    expect(slideLayout({ ...base, papel: "cita", source: FUENTE, evidencia: GRAFICO })).toBe("cita");
    expect(slideLayout({ ...base, papel: "dato", cifra: "80 km", evidencia: GRAFICO })).toBe("dato");
  });
});
