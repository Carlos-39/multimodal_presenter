import { createHash } from "node:crypto";
import { THEME_INIT_SCRIPT } from "./theme";

/**
 * La política de contenido del sitio. **Son dos, y la razón es que una sola costaría páginas.**
 *
 * La política fuerte usa un *nonce*, y Next solo puede inyectar un nonce al renderizar en el
 * servidor: una página prerenderizada se generó cuando no existía ninguna petición, así que sus
 * scripts saldrían sin nonce y el navegador los bloquearía. Su propia documentación lo dice sin
 * rodeos: usar nonce obliga a que TODAS las páginas sean dinámicas. Y aquí hay veintidós
 * estáticas, entre ellas la portada y los catorce capítulos de la bitácora.
 *
 * Renunciar a eso para proteger páginas que **no tocan datos de nadie** sería pagar con lo único
 * que esas páginas tienen (salir ya hechas) a cambio de nada. Así que la línea se traza por lo que
 * cada página maneja:
 *
 * - **Las de la aplicación** (`/`, `/biblioteca`, `/galeria`) muestran documentos de personas, así
 *   que llevan nonce y `strict-dynamic`: solo se ejecuta lo que esta petición autorizó.
 * - **Las de contenido fijo** (portada, bitácora) llevan `'unsafe-inline'` y siguen siendo
 *   estáticas. Sigue prohibido traer un script de otro dominio, que es la vía por la que algo
 *   inyectado se lleva lo que encuentra.
 *
 * Y un detalle del estándar que decide la forma de todo esto: **`'unsafe-inline'` se IGNORA si en
 * la misma directiva hay un hash o un nonce.** No se pueden poner los dos «por si acaso»; hay que
 * elegir, y por eso las dos políticas no se parecen más de lo que se parecen.
 */

/** Hash del único script en línea propio. Es una constante del módulo, así que su hash es fijo. */
export const HASH_SCRIPT_TEMA = `sha256-${createHash("sha256")
  .update(THEME_INIT_SCRIPT, "utf8")
  .digest("base64")}`;

/**
 * Qué rutas son «la aplicación». El resto es contenido fijo.
 *
 * `/` entra aunque a veces muestre la portada: es la MISMA ruta que muestra el workspace, y quien
 * decide es una cookie. Una política que dependiera de eso sería una política que cambia sola.
 */
function esDeLaAplicacion(ruta: string): boolean {
  return (
    ruta === "/" ||
    ruta.startsWith("/biblioteca") ||
    ruta.startsWith("/galeria") ||
    // El portón también: se renderiza por petición de todas formas, así que la política fuerte
    // sale gratis, y es la pantalla donde se escribe un secreto.
    ruta.startsWith("/acceso")
  );
}

/**
 * Las directivas que comparten las dos políticas, que son casi todas.
 *
 * Cuatro de ellas no son genéricas: son exactamente lo que esta aplicación necesita para cumplir
 * lo que promete, y quitarlas rompe en silencio lo que más importa.
 *
 * - `frame-src blob:` ( el PDF del panel de fuente se muestra en un `<iframe>` con URL `blob:`.
 *   Sin esto, «abrir la fuente» deja de funcionar, que es lo único que este proyecto afirma.
 * - `media-src blob:` ) la narración y el audio original se reproducen desde `blob:`.
 * - `img-src data:` ( las ilustraciones generadas viajan DENTRO del contrato, como data URIs.
 * - `style-src 'unsafe-inline'` ) hay estilos en atributo (`style={{…}}`) por toda la interfaz, y
 *   un nonce no cubre los atributos: eso es `style-src-attr`, que no admite nonce. Es la
 *   concesión consciente de esta política, y la barata: inyectar CSS no ejecuta código.
 */
function comunes(desarrollo: boolean): string[] {
  return [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "frame-src 'self' blob:",
    "font-src 'self'",
    // En desarrollo, la recarga en caliente abre un websocket contra el propio servidor.
    `connect-src 'self'${desarrollo ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Nadie nos mete en un marco. `X-Frame-Options` dice lo mismo para navegadores antiguos.
    "frame-ancestors 'none'",
    // Solo fuera de desarrollo: en local la aplicación va por http y esto la rompería.
    ...(desarrollo ? [] : ["upgrade-insecure-requests"]),
  ];
}

/**
 * La política que le toca a una ruta.
 *
 * `'unsafe-eval'` en desarrollo no es una dejadez: React lo usa para reconstruir en el navegador
 * la pila de un error del servidor. En producción ni React ni Next lo necesitan.
 */
export function politicaDeSeguridad(
  ruta: string,
  nonce: string,
  desarrollo: boolean,
): string {
  const evaluar = desarrollo ? " 'unsafe-eval'" : "";
  const script = esDeLaAplicacion(ruta)
    ? `script-src 'self' 'nonce-${nonce}' '${HASH_SCRIPT_TEMA}' 'strict-dynamic'${evaluar}`
    : `script-src 'self' 'unsafe-inline'${evaluar}`;
  return [script, ...comunes(desarrollo)].join("; ");
}

export { esDeLaAplicacion };
