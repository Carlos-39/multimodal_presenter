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
    await streamChat("doc", null, null, "¿?", [], (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["text", "text", "done"]);
    expect(events[1]).toMatchObject({ type: "text", text: "Hola" });
  });

  it("lanza si el HTTP no es OK (para que el llamador muestre el error)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([], false, 400)));
    await expect(streamChat("d", null, null, "q", [], () => {})).rejects.toThrow();
  });
});

describe("reenvío de la evidencia acústica (audio)", () => {
  /**
   * El chat, las sugeridas y el deck releen el documento. Para audio, ese documento es la
   * MISMA evidencia que produjo la fase de percepción: el frontend la reenvía en vez de que
   * el backend vuelva a percibir el audio. Si dejara de enviarse, el backend respondería 415
   * (no re-percibe por su cuenta), así que esto cubre un fallo real, no un detalle.
   */
  function capturarForm() {
    const visto: { form: FormData | null } = { form: null };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts: { body: FormData }) => {
        visto.form = opts.body;
        return sseResponse([
          'data: {"type":"done","response":{"content":{"content_type":"text","text":"x"},' +
            '"source":null,"grounding":"not_found"}}\n\n',
        ]);
      }),
    );
    return visto;
  }

  it("streamChat adjunta la evidencia cuando el documento es audio", async () => {
    const visto = capturarForm();
    await streamChat(null, null, '{"segments":[]}', "¿quién lo dijo?", [], () => {});
    expect(visto.form?.get("audio_evidence")).toBe('{"segments":[]}');
  });

  it("streamChat NO adjunta nada cuando no hay audio (texto y PDF intactos)", async () => {
    const visto = capturarForm();
    await streamChat("un documento", null, null, "¿?", [], () => {});
    expect(visto.form?.has("audio_evidence")).toBe(false);
  });

  it("fetchSuggestions adjunta la evidencia cuando el documento es audio", async () => {
    let form: FormData | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts: { body: FormData }) => {
        form = opts.body;
        return { ok: true, json: async () => ({ questions: [] }) };
      }),
    );
    await fetchSuggestions(null, null, '{"segments":[]}', SECTION);
    expect((form as FormData | null)?.get("audio_evidence")).toBe('{"segments":[]}');
  });
});

describe("fetchSuggestions", () => {
  it("devuelve las preguntas del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ questions: ["a?", "b?"] }) })),
    );
    expect(await fetchSuggestions("d", null, null, SECTION)).toEqual(["a?", "b?"]);
  });

  it("devuelve [] ante un fallo (las sugerencias no deben romper nada)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    expect(await fetchSuggestions("d", null, null, SECTION)).toEqual([]);
  });
});
