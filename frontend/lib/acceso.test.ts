import { describe, expect, it } from "vitest";
import { PORTON, decide, destinoSeguro, esLaPropiaMaquina, valorDeLaCookie } from "./acceso";

const CODIGO = "codigo-de-prueba-2026";
const COOKIE_BUENA = valorDeLaCookie(CODIGO);

const pide = (ruta: string, cookie?: string, codigo: string | undefined = CODIGO) =>
  decide({ url: new URL(`http://x${ruta}`), cookie, codigo });

describe("sin código configurado no hay portón", () => {
  it("todo pasa, que es lo que mantiene el desarrollo local igual que siempre", () => {
    // Se llama directo y no por el ayudante: pasarle `undefined` a un parámetro con valor por
    // defecto usa el valor por defecto, así que el ayudante nunca podría probar este caso.
    const sinCodigo = (ruta: string) =>
      decide({ url: new URL(`http://x${ruta}`), cookie: undefined, codigo: undefined });
    expect(sinCodigo("/").tipo).toBe("pasa");
    expect(sinCodigo("/api/transform/stream").tipo).toBe("pasa");
    expect(sinCodigo("/?c=loquesea").tipo).toBe("pasa");
  });
});

describe("con portón puesto", () => {
  it("una página sin permiso va a pedir el código, conservando a dónde iba", () => {
    const d = pide("/?p=P07");
    expect(d).toEqual({ tipo: "pide-codigo", destino: "/?p=P07" });
  });

  it("`/api/*` recibe un 401, no una redirección", () => {
    // Un `curl` no sabe rellenar un formulario, y lo que cuesta dinero está detrás de `/api`.
    expect(pide("/api/transform/stream").tipo).toBe("rechaza-api");
    expect(pide("/api/deck").tipo).toBe("rechaza-api");
  });

  it("la página del portón se ve sin permiso, o no habría forma de pedirlo", () => {
    expect(pide(PORTON.RUTA).tipo).toBe("pasa");
  });

  it("con la cookie buena se pasa", () => {
    expect(pide("/", COOKIE_BUENA).tipo).toBe("pasa");
    expect(pide("/api/deck", COOKIE_BUENA).tipo).toBe("pasa");
  });

  it("con una cookie inventada, no", () => {
    expect(pide("/", "a".repeat(64)).tipo).toBe("pide-codigo");
    expect(pide("/", "").tipo).toBe("pide-codigo");
    expect(pide("/", "no-es-hexadecimal").tipo).toBe("pide-codigo");
  });
});

describe("entrar con el código en la URL", () => {
  it("deja la cookie y devuelve a la MISMA página, ya sin el código", () => {
    const d = pide(`/?p=P07&c=${CODIGO}`);
    expect(d).toEqual({ tipo: "entra", cookie: COOKIE_BUENA, volverA: "/?p=P07" });
  });

  it("la cookie lleva el hash, nunca el código", () => {
    const d = pide(`/?c=${CODIGO}`);
    expect(d.tipo === "entra" && d.cookie).not.toContain(CODIGO);
    expect(d.tipo === "entra" && d.cookie).toMatch(/^[0-9a-f]{64}$/);
  });

  it("desde el portón vuelve al destino que traía", () => {
    const d = pide(`${PORTON.RUTA}?c=${CODIGO}&destino=%2F%3Fp%3DP07`);
    expect(d).toEqual({ tipo: "entra", cookie: COOKIE_BUENA, volverA: "/?p=P07" });
  });

  it("un código equivocado no abre nada", () => {
    expect(pide("/?c=otra-cosa").tipo).toBe("pide-codigo");
    // Ni uno que empiece igual: la comparación es sobre el hash entero.
    expect(pide(`/?c=${CODIGO.slice(0, -1)}`).tipo).toBe("pide-codigo");
  });

  it("y no se queda pegado al destino", () => {
    // Si no, después de entrar con el bueno se aterrizaría en una URL con el malo dentro, y ese
    // intento fallido viviría en la barra y en el historial.
    expect(pide("/?p=P07&c=otra-cosa")).toEqual({ tipo: "pide-codigo", destino: "/?p=P07" });
  });
});

describe("el destino no puede sacarte de aquí", () => {
  it("acepta rutas de este sitio", () => {
    expect(destinoSeguro("/?p=P07")).toBe("/?p=P07");
    expect(destinoSeguro("/biblioteca")).toBe("/biblioteca");
  });

  it("rechaza lo que es una URL absoluta disfrazada de ruta", () => {
    // `//otro.sitio` es `https://otro.sitio`. Aceptarlo convertiría el portón en un trampolín
    // para mandar a alguien a otra parte con nuestro nombre delante.
    expect(destinoSeguro("//evil.example")).toBe("/");
    expect(destinoSeguro("https://evil.example")).toBe("/");
    expect(destinoSeguro("javascript:alert(1)")).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
  });
});

describe("la cookie se marca Secure salvo en la propia máquina", () => {
  it("reconoce el localhost en sus cuatro formas", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "[::1]"]) {
      expect(esLaPropiaMaquina(host)).toBe(true);
    }
  });

  it("y cualquier otra cosa es un sitio de verdad", () => {
    // Se mira el host y no `NODE_ENV`: una cookie Secure sobre http no se guarda, así que atarlo
    // al modo dejaba un bucle de redirecciones al levantar la build de producción en local.
    for (const host of ["presenter.up.railway.app", "localhost.evil.example", "0.0.0.0"]) {
      expect(esLaPropiaMaquina(host)).toBe(false);
    }
  });
});
