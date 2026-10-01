import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTest, flush, initTelemetry, track } from "./telemetry";

/**
 * El tracker toca APIs del navegador (window, sessionStorage, sendBeacon…). Los tests del repo
 * corren en Node, así que se stubbean esos globals a mano (sin traer jsdom). Se verifica la
 * tubería: sobre del evento, reuso del id de sesión, participante por URL y respaldo a fetch.
 */

function fakeSessionStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

let beacon: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

async function bodyOf(blob: Blob): Promise<{ events: Array<Record<string, unknown>> }> {
  return JSON.parse(await blob.text());
}

beforeEach(() => {
  __resetForTest();
  beacon = vi.fn(() => true);
  fetchMock = vi.fn(async () => ({ ok: true }) as Response);
  vi.stubGlobal("window", {
    location: { href: "http://localhost:3000/?p=P07" },
    addEventListener: vi.fn(),
  });
  vi.stubGlobal("document", { addEventListener: vi.fn(), visibilityState: "visible" });
  vi.stubGlobal("sessionStorage", fakeSessionStorage());
  vi.stubGlobal("navigator", { sendBeacon: beacon });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  __resetForTest();
  vi.unstubAllGlobals();
});

describe("telemetry tracker", () => {
  it("encola eventos y los envía en lote con el sobre correcto", async () => {
    track("transform_submit", { source_kind: "pdf" });
    track("detail_mode_change", { from: "summary", to: "detailed", ms_in_from: 1200 });
    flush();

    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe("/api/telemetry");
    const { events } = await bodyOf(blob as Blob);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ name: "transform_submit", seq: 0, data: { source_kind: "pdf" } });
    expect(events[1]).toMatchObject({ name: "detail_mode_change", seq: 1 });
    expect(typeof events[0].session_id).toBe("string");
    expect(events[0].ts).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO-8601
  });

  it("no envía nada si el buffer está vacío", () => {
    flush();
    expect(beacon).not.toHaveBeenCalled();
  });

  it("reusa el mismo id de sesión entre eventos", async () => {
    track("session_start");
    track("source_open", { origin: "chat", grounding_status: "verified" });
    flush();
    const { events } = await bodyOf(beacon.mock.calls[0][1] as Blob);
    expect(events[0].session_id).toBe(events[1].session_id);
  });

  it("initTelemetry lee el participante de la URL (?p=) y emite session_start", async () => {
    initTelemetry();
    flush();
    const { events } = await bodyOf(beacon.mock.calls[0][1] as Blob);
    expect(events[0].name).toBe("session_start");
    expect(events[0].participant).toBe("P07");
  });

  it("cae a fetch keepalive cuando sendBeacon falla", async () => {
    beacon.mockReturnValue(false);
    track("typed_question_submit", { question_len: 15 });
    flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ method: "POST", keepalive: true });
    const { events } = JSON.parse(init.body as string);
    expect(events[0]).toMatchObject({ name: "typed_question_submit", data: { question_len: 15 } });
  });

  it("initTelemetry es idempotente (no re-arranca la sesión)", () => {
    initTelemetry();
    initTelemetry();
    flush();
    // Un solo session_start en el primer arranque (el segundo init no hace nada).
    expect(beacon).toHaveBeenCalledTimes(1);
  });
});
