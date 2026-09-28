import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSuggestions, streamChat } from "./chat";
import type { ChatStreamEvent, Section } from "./types";

function sseResponse(chunks: string[], ok = true, status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok, status, body: stream, json: async () => ({}) } as unknown as Response;
}

const SECTION: Section = {
  id: "s1",
  title: "t",
  role: "core",
  source: { document_id: "d", quote: "q", page: null, char_start: null, char_end: null },
  content: { content_type: "text", text: "x" },
};

afterEach(() => vi.unstubAllGlobals());

describe("streamChat", () => {
  it("entrega los eventos SSE en orden y termina en done", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          'data: {"type":"text","text":"Ho"}\n\n',
          'data: {"type":"text","text":"Hola"}\n\n',
          'data: {"type":"done","response":{"content":{"content_type":"text","text":"Hola"},"source":null,"grounding":"not_found"}}\n\n',
        ]),
      ),
    );
    const events: ChatStreamEvent[] = [];
    await streamChat("doc", null, "¿?", [], (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["text", "text", "done"]);
    expect(events[1]).toMatchObject({ type: "text", text: "Hola" });
  });

  it("lanza si el HTTP no es OK (para que el llamador muestre el error)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([], false, 400)));
    await expect(streamChat("d", null, "q", [], () => {})).rejects.toThrow();
  });
});

describe("fetchSuggestions", () => {
  it("devuelve las preguntas del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ questions: ["a?", "b?"] }) })),
    );
    expect(await fetchSuggestions("d", null, SECTION)).toEqual(["a?", "b?"]);
  });

  it("devuelve [] ante un fallo (las sugerencias no deben romper nada)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    expect(await fetchSuggestions("d", null, SECTION)).toEqual([]);
  });
});
