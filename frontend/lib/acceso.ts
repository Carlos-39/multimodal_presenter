import { createHash, timingSafeEqual } from "node:crypto";

/**
 * El portón: quién puede llegar a la aplicación.
 *
 * **No identifica a nadie.** Distingue «tiene el enlace» de «no lo tiene», y nada más. No es una
 * cuenta, no sabe quién eres y no se guarda en ninguna parte. Existe por una razón concreta: cada
 * presentación cuesta dinero de verdad, y una URL pública que genera cuando se la pide es una URL
 * que cualquiera puede usar para gastar lo que no es suyo.
 *
 * **Si no hay código configurado, no hay portón.** En local no cambia nada y el `ENOENT` de una
 * variable que falta no puede dejar a nadie fuera por accidente.
 *
 * **Sin contador de intentos aquí, a propósito.** La documentación de Next dice que el proxy «no
 * debe confiar en módulos compartidos ni en variables globales», así que un contador en memoria
 * contradiría su contrato y se rompería el día que esto se sirva desde más de un sitio. Y contra un
 * código de dieciséis caracteres al azar —ochenta bits— un contador no añade nada medible: el
 * límite de intentos vive donde el secreto es débil, que es el login, y ya está puesto.
 */

const COOKIE = "mmp_acceso";
/** Lo que dura el permiso. Una tanda de sesiones cabe de sobra. */
const DURACION_S = 30 * 24 * 60 * 60;

function sha256(texto: string): Buffer {
  return createHash("sha256").update(texto, "utf8").digest();
}

/**
 * Lo que se guarda en la cookie: el hash del código, nunca el código.
 *
 * Que la cookie no lleve el código en claro importa aunque la cookie sea igual de válida que él:
 * así el código no queda escrito en el navegador de nadie, listo para copiarse y repartirse por
 * ahí. Lo que entrega el facilitador sigue siendo suyo.
 */
export function valorDeLaCookie(codigo: string): string {
  return sha256(codigo).toString("hex");
}

/**
 * ¿Coincide? Comparación en tiempo constante.
 *
 * Los dos lados son digests de sha256, así que miden siempre 32 bytes y `timingSafeEqual` nunca
 * lanza por longitudes distintas — que es su única forma de fallar y la que haría falsa la
 * promesa de «tiempo constante».
 */
function iguales(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cookieValida(valor: string | undefined, codigo: string): boolean {
  if (!valor) return false;
  const esperado = sha256(codigo);
  const recibido = Buffer.from(valor, "hex");
  return iguales(esperado, recibido);
}

export function codigoValido(candidato: string | null, codigo: string): boolean {
  if (!candidato) return false;
  return iguales(sha256(candidato), sha256(codigo));
}

/**
 * A dónde volver después de entrar, si es un sitio al que se puede volver.
 *
 * Solo rutas de aquí: `//otro.sitio` es una URL absoluta disfrazada de ruta, y aceptarla
 * convertiría el portón en un trampolín para mandar a alguien a otra parte con nuestro nombre
 * delante. Ante cualquier duda, la raíz.
 */
export function destinoSeguro(destino: string | null): string {
  if (!destino || !destino.startsWith("/") || destino.startsWith("//")) return "/";
  return destino;
}

/** La URL de esta misma petición, sin el código. Lo que se ve en la barra después de entrar. */
export function sinElCodigo(url: URL): URL {
  const limpia = new URL(url);
  limpia.searchParams.delete("c");
  return limpia;
}

/** Si la petición viene de la propia máquina, donde no hay https y tampoco hace falta. */
export function esLaPropiaMaquina(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export const PORTON = {
  COOKIE,
  DURACION_S,
  /** La página del portón. Tiene que quedar FUERA del portón o no se podría llegar a ella. */
  RUTA: "/acceso",
} as const;

/** Qué hacer con una petición. Separado del proxy para poder probarlo sin levantar un servidor. */
export type Decision =
  | { tipo: "pasa" }
  | { tipo: "entra"; cookie: string; volverA: string }
  | { tipo: "rechaza-api" }
  | { tipo: "pide-codigo"; destino: string };

export function decide(opciones: {
  url: URL;
  cookie: string | undefined;
  codigo: string | undefined;
}): Decision {
  const { url, cookie, codigo } = opciones;

  // Sin código configurado no hay portón. Es lo que mantiene el desarrollo local igual que siempre.
  if (!codigo) return { tipo: "pasa" };

  const candidato = url.searchParams.get("c");
  if (codigoValido(candidato, codigo)) {
    // Se entra y se limpia la URL: el código no tiene por qué quedarse en la barra, ni en el
    // historial, ni en la captura de pantalla que alguien mande por ahí.
    const volverA =
      url.pathname === PORTON.RUTA
        ? destinoSeguro(url.searchParams.get("destino"))
        : sinElCodigo(url).pathname + sinElCodigo(url).search;
    return { tipo: "entra", cookie: valorDeLaCookie(codigo), volverA };
  }

  if (cookieValida(cookie, codigo)) return { tipo: "pasa" };

  // `/api/*` no es una página: un 401 se puede leer, una redirección a un formulario no.
  if (url.pathname.startsWith("/api/")) return { tipo: "rechaza-api" };

  // La propia página del portón se ve sin permiso, o no habría forma de pedirlo.
  if (url.pathname === PORTON.RUTA) return { tipo: "pasa" };

  // El destino va SIN el código. Si alguien llegó con uno equivocado, arrastrarlo dejaría un
  // secreto fallido dando vueltas por la barra y el historial, y después del portón aterrizaría
  // en una URL con basura dentro.
  const limpia = sinElCodigo(url);
  return { tipo: "pide-codigo", destino: limpia.pathname + limpia.search };
}
