import { afterEach, describe, expect, it, vi } from "vitest";
import { cabecerasHaciaElBackend, proxyToBackend } from "./proxyToBackend";

afterEach(() => vi.unstubAllGlobals());

/** Una petición como la que llega del navegador: mismo origen, así que trae la cookie. */
function peticion(cabeceras: Record<string, string>): Request {
  return new Request("http://localhost:3000/api/deck", {
    method: "POST",
    headers: cabeceras,
    body: "x",
  });
}

describe("cabecerasHaciaElBackend", () => {
  it("reenvía la cookie de sesión", () => {
    const h = cabecerasHaciaElBackend(
      peticion({ "content-type": "multipart/form-data; boundary=xyz", cookie: "mmp_sesion=abc123" }),
    );
    // Es el fondo del arreglo: sin esto, el backend ve una petición anónima y `document_id`
    // (que exige cuenta y propiedad) responde 401 sobre una presentación que SÍ es tuya.
    expect(h.get("cookie")).toBe("mmp_sesion=abc123");
    expect(h.get("content-type")).toBe("multipart/form-data; boundary=xyz");
  });

  it("no inventa una cabecera cookie cuando no hay sesión", () => {
    // El modo invitado es el estado normal de esta aplicación: mandar `cookie: null` o `cookie: ""`
    // haría que una petición sin sesión se distinga de una petición sin cookie, y no hay motivo.
    const h = cabecerasHaciaElBackend(peticion({ "content-type": "text/plain" }));
    expect(h.has("cookie")).toBe(false);
  });

  it("no copia las cabeceras que describen ESTA conexión", () => {
    const h = cabecerasHaciaElBackend(
      peticion({ "content-type": "text/plain", cookie: "mmp_sesion=a", "x-forwarded-for": "1.2.3.4" }),
    );
    // `content-length` es el caso que de verdad muerde: copiado de la petición de entrada deja al
    // backend esperando un cuerpo de otro tamaño que el que le llega.
    expect(h.has("content-length")).toBe(false);
    expect(h.has("host")).toBe(false);
    expect(h.has("x-forwarded-for")).toBe(false);
    expect([...h.keys()].sort()).toEqual(["content-type", "cookie"]);
  });
});

describe("proxyToBackend", () => {
  it("manda la cookie al backend", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await proxyToBackend(peticion({ "content-type": "text/plain", cookie: "mmp_sesion=xyz" }), "/deck");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("cookie")).toBe("mmp_sesion=xyz");
  });

  it("devuelve 502 y no lanza si el backend no contesta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin backend");
      }),
    );
    // El cliente usa el 502 para caer al camino no-streaming, así que tiene que ser un 502 de
    // verdad y no una excepción.
    const res = await proxyToBackend(peticion({ "content-type": "text/plain" }), "/deck");
    expect(res.status).toBe(502);
  });
});
