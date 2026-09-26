import { describe, expect, it } from "vitest";
import { DEFAULT_DETAIL_LEVEL, visibleSections } from "./detail";
import type { Section, SectionRole } from "./types";

function section(id: string, role: SectionRole): Section {
  return {
    id,
    title: id,
    role,
    source: { document_id: "d", quote: "q", page: null, char_start: null, char_end: null },
    content: { content_type: "text", text: "t" },
  };
}

const CORE_A = section("a", "core");
const SAT_B = section("b", "satellite");
const CORE_C = section("c", "core");

describe("visibleSections", () => {
  it("resumen muestra solo los núcleos", () => {
    const visible = visibleSections([CORE_A, SAT_B, CORE_C], "summary");
    expect(visible.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("detallado muestra núcleos y satélites en orden", () => {
    const visible = visibleSections([CORE_A, SAT_B, CORE_C], "detailed");
    expect(visible.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("sin satélites: detallado == resumen", () => {
    const sections = [CORE_A, CORE_C];
    expect(visibleSections(sections, "summary")).toEqual(visibleSections(sections, "detailed"));
  });

  it("sin núcleos: resumen cae a mostrar todo (nunca vacío)", () => {
    const sections = [SAT_B];
    expect(visibleSections(sections, "summary").map((s) => s.id)).toEqual(["b"]);
  });

  it("el nivel por defecto es resumen", () => {
    expect(DEFAULT_DETAIL_LEVEL).toBe("summary");
  });
});
