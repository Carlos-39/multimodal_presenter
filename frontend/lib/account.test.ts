import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actualizarPresentacion,
  guardarChat,
  guardarNarracion,
  textoDelDocumento,
  urlDeLaNarracion,
} from "./account";

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

describe("artefactos guardados", () => {
  it("sube el mp3 como audio, no envuelto en un formulario", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const audio = new Blob([new Uint8Array([0x49, 0x44, 0x33])], { type: "audio/mpeg" });
    await guardarNarracion("pre-1", audio);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/biblioteca/presentaciones/pre-1/artefactos/narracion");
    expect(init.method).toBe("PUT");
    // Bytes tal cual: el backend los escribe en disco como mp3, así que envolverlos en un
    // multipart solo añadiría una capa que habría que deshacer.
    expect(init.body).toBe(audio);
  });

  it("no lanza si subir la narración falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin red");
      }),
    );
    // Lo que se está escuchando ya está bien; lo peor que pasa es volver a generarla.
    await expect(guardarNarracion("pre-1", new Blob())).resolves.toBeUndefined();
  });

  it("la narración se referencia por URL, para que el reproductor la descargue él", () => {
    // Devolver los bytes obligaría a esperar el archivo entero antes de que suene nada.
    expect(urlDeLaNarracion("pre-1")).toBe(
      "/api/biblioteca/presentaciones/pre-1/artefactos/narracion",
    );
  });
});

describe("actualizarPresentacion", () => {
  const PAYLOAD = {
    presentation: { title: "t", sections: [] },
    grounding: {
      source_kind: "text" as const,
      sections: [],
      total_sections: 0,
      verified_sections: 0,
      unverified_sections: 0,
      not_found_sections: 0,
    },
  };

  it("va por PUT a la presentación concreta y no manda el documento", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await actualizarPresentacion("pre-1", "Mi título", PAYLOAD);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/biblioteca/presentaciones/pre-1");
    expect(init.method).toBe("PUT");
    // JSON y no formulario: un payload con ilustraciones son varios megas, y los campos de
    // formulario que no son archivo están topados en 1 MB. Además el documento no viaja: es el
    // mismo por definición, y si cambiara sería otra presentación.
    const cuerpo = JSON.parse(init.body as string);
    expect(Object.keys(cuerpo).sort()).toEqual(["payload", "titulo"]);
  });

  it("sí lanza si falla, al revés que el chat o los artefactos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response));
    // Aquí el usuario PULSÓ guardar y está mirando el botón: tiene que poder decirle que no pudo.
    await expect(actualizarPresentacion("pre-1", "t", PAYLOAD)).rejects.toThrow();
  });
});
