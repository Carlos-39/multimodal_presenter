import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTest, flush, initTelemetry, track } from "./telemetry";

/**
 * El tracker toca APIs del navegador (window, sessionStorage, fetch…). Los tests del repo corren
 * en Node, así que se stubbean esos globals a mano (sin traer jsdom). Se verifica la tubería:
 * sobre del evento, reuso del id de sesión, participante por URL — y, sobre todo, que un evento
 * no se da por entregado hasta que el servidor lo dice.
 *
 * Ese último grupo no es teórico: en la primera prueba real se perdieron 8 de 60 eventos porque
 * la cola se vaciaba antes de saber si el envío había llegado.
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

let fetchMock: ReturnType<typeof vi.fn>;
let almacen: Storage;

/** Deja correr las promesas pendientes (el `then` del envío). */
const asentar = () => new Promise((r) => setTimeout(r, 0));

function loteDe(llamada: number): Array<Record<string, unknown>> {
  const [, init] = fetchMock.mock.calls[llamada];
  return JSON.parse((init as RequestInit).body as string).events;
}

beforeEach(() => {
  __resetForTest();
  almacen = fakeSessionStorage();
  fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as Response);
  vi.stubGlobal("window", {
    location: { href: "http://localhost:3000/?p=P07" },
    addEventListener: vi.fn(),
  });
  vi.stubGlobal("document", { addEventListener: vi.fn(), visibilityState: "visible" });
  vi.stubGlobal("sessionStorage", almacen);
  vi.stubGlobal("navigator", { sendBeacon: vi.fn(() => true) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  __resetForTest();
  vi.unstubAllGlobals();
});

describe("telemetry tracker", () => {
  it("encola eventos y los envía en lote con el sobre correcto", () => {
    track("transform_submit", { source_kind: "pdf" });
    track("detail_mode_change", { from: "summary", to: "detailed", ms_in_from: 1200 });
    flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/telemetry");
    expect(init).toMatchObject({ method: "POST", keepalive: true });
    const events = loteDe(0);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      name: "transform_submit",
      seq: 0,
      data: { source_kind: "pdf" },
    });
    expect(events[1]).toMatchObject({ name: "detail_mode_change", seq: 1 });
    expect(typeof events[0].session_id).toBe("string");
    expect(events[0].ts).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO-8601
  });

  it("no envía nada si el buffer está vacío", () => {
    flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reusa el mismo id de sesión entre eventos", () => {
    track("session_start");
    track("source_open", { origin: "chat", grounding_status: "verified" });
    flush();
    const events = loteDe(0);
    expect(events[0].session_id).toBe(events[1].session_id);
  });

  it("initTelemetry lee el participante de la URL (?p=) y emite session_start", () => {
    initTelemetry();
    flush();
    const events = loteDe(0);
    expect(events[0].name).toBe("session_start");
    expect(events[0].participant).toBe("P07");
  });

  it("el contador sigue subiendo tras una recarga de la misma pestaña", async () => {
    // Una recarga reinicia el módulo pero NO el sessionStorage: la sesión es la misma, así que
    // `seq` tiene que continuar donde iba. Si volviera a 0 habría dos eventos con seq 0 en la
    // misma sesión y el orden dentro de ella dejaría de ser inequívoco (el backend documenta
    // este campo como "contador monótono por sesión", y el análisis ordena por él).
    track("transform_submit", { source_kind: "pdf" });
    track("detail_mode_change", { from: "summary", to: "detailed", ms_in_from: 900 });
    flush();
    await asentar();
    const sesion = loteDe(0)[0].session_id;

    __resetForTest(); // la recarga: módulo nuevo, mismo sessionStorage
    track("source_open", { origin: "section", grounding_status: "verified" });
    flush();
    const despues = loteDe(1);

    expect(despues[0].session_id).toBe(sesion); // misma sesión
    expect(despues[0].seq).toBe(2); // y el contador NO volvió a 0
  });

  it("initTelemetry es idempotente (no re-arranca la sesión)", () => {
    initTelemetry();
    initTelemetry();
    flush();
    expect(loteDe(0)).toHaveLength(1); // un solo session_start
  });
});

/**
 * El grupo que paga la deuda: 8 de 60 eventos perdidos en la primera prueba real, en lotes
 * enteros, porque la cola se vaciaba antes de la confirmación y el fallo se descartaba en
 * silencio. `seq` es un contador sin huecos, así que las ausencias se vieron contándolas.
 */
describe("ningún evento se da por entregado sin confirmación", () => {
  it("un envío que falla deja los eventos en la cola, y el siguiente los reintenta", async () => {
    fetchMock.mockRejectedValueOnce(new Error("se cayó la red"));
    track("transform_submit", { source_kind: "pdf" });
    flush();
    await asentar();

    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    flush();
    await asentar();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(loteDe(1)[0]).toMatchObject({ name: "transform_submit", seq: 0 });
  });

  it("una respuesta de error del servidor también se reintenta", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    track("view_change", { to: "slides" });
    flush();
    await asentar();

    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    flush();
    await asentar();

    expect(loteDe(1)[0]).toMatchObject({ name: "view_change", seq: 0 });
  });

  it("lo confirmado no se reenvía", async () => {
    track("transform_submit", { source_kind: "pdf" });
    flush();
    await asentar();

    flush(); // no queda nada pendiente
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un lote que el servidor nunca aceptará no se queda atascado delante", async () => {
    // 422: el backend lo rechaza por lo que es, no por cuándo llegó. Reintentarlo para siempre
    // bloquearía todo lo que venga detrás, que es peor que perder ese lote.
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 } as Response);
    track("view_change", { to: "slides" });
    flush();
    await asentar();

    flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lo que no llegó a enviarse sobrevive a una recarga", async () => {
    fetchMock.mockRejectedValueOnce(new Error("sin red"));
    track("typed_question_submit", { question_len: 15 });
    flush();
    await asentar();

    // La recarga: módulo nuevo, mismo sessionStorage. Sin persistir la cola, el evento moriría
    // aquí — y es justo el momento en que un móvil cambia de aplicación o se queda sin cobertura.
    __resetForTest();
    fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
    initTelemetry();
    flush();
    await asentar();

    const nombres = fetchMock.mock.calls.flatMap((_, i) => loteDe(i).map((e) => e.name));
    expect(nombres).toContain("typed_question_submit");
  });

  it("no manda dos lotes a la vez, salvo al cerrarse la pestaña", async () => {
    let resolver: (r: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolver = r)));
    track("view_change", { to: "slides" });
    flush(); // se queda en vuelo

    track("view_change", { to: "document" });
    flush(); // no debe salir: hay uno en curso
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // `pagehide` no puede esperar: puede no haber otra oportunidad, y duplicar es barato porque
    // el exportador descarta repetidos.
    flush(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolver({ ok: true, status: 204 } as Response);
    await asentar();
  });
});
