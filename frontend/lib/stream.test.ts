import { describe, expect, it } from "vitest";
import { parseSSE } from "./stream";

describe("parseSSE", () => {
  it("parsea eventos completos y deja el resto incompleto", () => {
    const buffer =
      'data: {"type":"start","title":"T"}\n\n' +
      'data: {"type":"section","section":{},"grounding":{},"chart_note":null}\n\n' +
      'data: {"type":"do';
    const { events, rest } = parseSSE(buffer);
    expect(events.map((e) => e.type)).toEqual(["start", "section"]);
    expect(rest).toBe('data: {"type":"do');
  });

  it("sin evento completo no emite nada", () => {
    const { events, rest } = parseSSE('data: {"type":"star');
    expect(events).toEqual([]);
    expect(rest).toBe('data: {"type":"star');
  });

  it("ignora JSON mal formado sin romper", () => {
    const { events } = parseSSE("data: no-es-json\n\n" + 'data: {"type":"error","message":"x"}\n\n');
    expect(events.map((e) => e.type)).toEqual(["error"]);
  });
});
