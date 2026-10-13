import { describe, expect, it } from "vitest";
import { entregaSSE, parseSSE } from "./stream";

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

describe("entregaSSE: cuando el navegador no entrega el cuerpo por partes", () => {
  const SSE =
    'data: {"type":"section","section":{"id":"s1"}}\n\n' +
    'data: {"type":"done","grounding":{}}\n\n';

  it("lee la respuesta entera y entrega los mismos eventos", async () => {
    // Es el navegador de dentro de WhatsApp: `response.body` no existe, así que no hay
    // `getReader()` y la respuesta solo se puede leer al final. Antes esto se trataba como un
    // fallo aunque el HTTP fuera 200.
    const res = { ok: true, body: null, text: async () => SSE } as unknown as Response;
    const vistos: unknown[] = [];
    await entregaSSE(res, (e) => vistos.push(e));
    expect(vistos).toHaveLength(2);
    expect((vistos[0] as { type: string }).type).toBe("section");
    expect((vistos[1] as { type: string }).type).toBe("done");
  });

  it("tolera que el último evento venga sin la línea en blanco final", async () => {
    const res = {
      ok: true,
      body: null,
      text: async () => 'data: {"type":"done"}',
    } as unknown as Response;
    const vistos: unknown[] = [];
    await entregaSSE(res, (e) => vistos.push(e));
    expect(vistos).toHaveLength(1);
  });

  it("y por partes entrega lo mismo, en el mismo orden", async () => {
    // El troceo cae a propósito EN MITAD de un evento: así se comprueba que el buffer aguanta.
    const trozos = [SSE.slice(0, 30), SSE.slice(30, 70), SSE.slice(70)];
    let i = 0;
    const res = {
      ok: true,
      body: {
        getReader: () => ({
          read: async () =>
            i < trozos.length
              ? { value: new TextEncoder().encode(trozos[i++]), done: false }
              : { value: undefined, done: true },
        }),
      },
    } as unknown as Response;
    const vistos: unknown[] = [];
    await entregaSSE(res, (e) => vistos.push(e));
    expect(vistos.map((e) => (e as { type: string }).type)).toEqual(["section", "done"]);
  });
});
