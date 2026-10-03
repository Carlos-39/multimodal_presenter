import { afterEach, describe, expect, it, vi } from "vitest";
import { guardarChat, textoDelDocumento } from "./account";

afterEach(() => vi.unstubAllGlobals());

describe("guardarChat", () => {
  it("manda el historial completo, no el último turno", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await guardarChat("pre-1", [
      { rol: "user", texto: "¿y?" },
      { rol: "assistant", texto: "pues eso" },
    ]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/biblioteca/presentaciones/pre-1/chat");
    expect(init.method).toBe("PUT");
    // Es el fondo de la decisión: reemplazar en vez de añadir. Así lo guardado no puede derivar
    // de la conversación real por un reintento o una petición perdida.
    expect(JSON.parse(init.body as string).mensajes).toHaveLength(2);
  });

  it("no lanza si la petición falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin red");
      }),
    );
    // Perder un turno del historial no puede romper el chat que se está usando: lo que hay en
    // pantalla sigue siendo la conversación verdadera y el turno siguiente la vuelve a mandar
    // entera, así que un fallo suelto se corrige solo.
    await expect(guardarChat("pre-1", [])).resolves.toBeUndefined();
  });
});

describe("textoDelDocumento", () => {
  it("devuelve null si no se puede leer, en vez de lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response));
    // Sin el texto el resto sigue usable y el panel de fuente lo dice por sí mismo; lanzar aquí
    // dejaría la presentación restaurada sin montar.
    expect(await textoDelDocumento("doc-1")).toBeNull();
  });
});
