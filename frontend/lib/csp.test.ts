import { describe, expect, it } from "vitest";
import { HASH_SCRIPT_TEMA, esDeLaAplicacion, politicaDeSeguridad } from "./csp";

const directivas = (politica: string) =>
  Object.fromEntries(
    politica.split("; ").map((d) => {
      const [nombre, ...resto] = d.split(" ");
      return [nombre, resto.join(" ")];
    }),
  );

describe("lo que la política NO puede romper", () => {
  // Cada una de estas cuatro sostiene algo que el proyecto promete. Si se cae una, la aplicación
  // sigue pareciendo correcta hasta que alguien abre una fuente, y entonces ya es tarde.
  const politica = politicaDeSeguridad("/", "abc123", false);
  const d = directivas(politica);

  it("deja mostrar el PDF del panel de fuente", () => {
    // Va en un <iframe src="blob:">. Sin esto, «abrir la fuente» deja de funcionar.
    expect(d["frame-src"]).toContain("blob:");
  });

  it("deja sonar la narración y el audio original", () => {
    expect(d["media-src"]).toContain("blob:");
  });

  it("deja ver las ilustraciones, que son data URIs dentro del contrato", () => {
    expect(d["img-src"]).toContain("data:");
  });

  it("deja los estilos en atributo, que un nonce no puede cubrir", () => {
    // `style={{…}}` es `style-src-attr`, y esa directiva no admite nonce: o se permite en línea o
    // la interfaz se queda sin la mitad de sus medidas.
    expect(d["style-src"]).toContain("'unsafe-inline'");
  });
});

describe("las dos políticas", () => {
  it("la de la aplicación va con nonce y strict-dynamic", () => {
    const d = directivas(politicaDeSeguridad("/biblioteca", "abc123", false));
    expect(d["script-src"]).toContain("'nonce-abc123'");
    expect(d["script-src"]).toContain("'strict-dynamic'");
    expect(d["script-src"]).toContain(HASH_SCRIPT_TEMA);
    // Si estuviera, el navegador IGNORARÍA el nonce y el hash: el estándar dice que
    // 'unsafe-inline' se descarta cuando hay alguno de los dos.
    expect(d["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("la de contenido fijo va sin nonce, para que esas páginas sigan siendo estáticas", () => {
    const d = directivas(politicaDeSeguridad("/making-of/contrato", "abc123", false));
    expect(d["script-src"]).toContain("'unsafe-inline'");
    // Y sin hash ni nonce, por la misma regla al revés: cualquiera de los dos anularía el
    // 'unsafe-inline' y bloquearía los scripts que Next incrusta al prerenderizar.
    expect(d["script-src"]).not.toContain("nonce-");
    expect(d["script-src"]).not.toContain("sha256-");
  });

  it("sigue prohibido traer un script de otro dominio en las dos", () => {
    for (const ruta of ["/", "/inicio"]) {
      const d = directivas(politicaDeSeguridad(ruta, "abc123", false));
      expect(d["script-src"]).not.toContain("http");
      expect(d["object-src"]).toBe("'none'");
      expect(d["frame-ancestors"]).toBe("'none'");
      expect(d["base-uri"]).toBe("'self'");
    }
  });

  it("reparte las rutas por lo que cada una maneja", () => {
    expect(esDeLaAplicacion("/")).toBe(true);
    expect(esDeLaAplicacion("/biblioteca")).toBe(true);
    expect(esDeLaAplicacion("/galeria")).toBe(true);
    expect(esDeLaAplicacion("/inicio")).toBe(false);
    expect(esDeLaAplicacion("/making-of")).toBe(false);
    expect(esDeLaAplicacion("/making-of/contrato")).toBe(false);
  });
});

describe("desarrollo y producción no son lo mismo", () => {
  it("en desarrollo se permite eval y el websocket de la recarga", () => {
    const d = directivas(politicaDeSeguridad("/", "abc123", true));
    // React lo usa para reconstruir en el navegador la pila de un error del servidor.
    expect(d["script-src"]).toContain("'unsafe-eval'");
    expect(d["connect-src"]).toContain("ws:");
  });

  it("en producción no, y además se fuerza https", () => {
    const politica = politicaDeSeguridad("/", "abc123", false);
    expect(politica).not.toContain("'unsafe-eval'");
    expect(politica).not.toContain("ws:");
    expect(politica).toContain("upgrade-insecure-requests");
  });

  it("en local no se fuerza https, o la aplicación no abriría", () => {
    expect(politicaDeSeguridad("/", "abc123", true)).not.toContain("upgrade-insecure-requests");
  });
});
