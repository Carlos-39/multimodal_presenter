/**
 * Proxy server-side (route handlers) hacia el backend para endpoints LENTOS de generación.
 *
 * Motivo (mismo espíritu que los route handlers de /transform/stream y /chat/stream): el
 * `rewrites()` de Next corta la conexión con "socket hang up"/ECONNRESET en respuestas que tardan
 * decenas de segundos (generación de imagen ~20-30s, narración TTS ~17s, explicación ~10s). Un
 * route handler con `fetch` (undici, timeouts largos) sí espera la respuesta completa. Solo se usa
 * desde los route handlers de /api/* (server-side); nunca desde el cliente.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/**
 * Las cabeceras que SÍ tienen que cruzar hacia el backend. Dos, y ninguna más.
 *
 * **La cookie de sesión es la que faltaba, y su ausencia rompía algo real.** El navegador la manda
 * aquí porque esto es su mismo origen, pero estos manejadores reenviaban solo el `content-type`,
 * así que al backend llegaba una petición anónima. Y cuatro de los endpoints que pasan por aquí
 * aceptan `document_id`, que exige cuenta Y propiedad: abrir una presentación guardada cuya fuente
 * es un PDF y preguntarle al chat daba 401, porque al restaurarla ya no hay `File` y lo único que
 * viaja es el id. Las fuentes de texto se salvaban por casualidad —el texto se trae entero al
 * restaurar y va en el formulario—, que es justo lo que hacía el fallo difícil de ver.
 *
 * No se reenvía el resto de la petición a propósito. `host`, `content-length` y `connection`
 * describen ESTA conexión, no la de salida, y copiarlas es la forma clásica de que el backend
 * reciba una longitud que no corresponde al cuerpo que le llega.
 *
 * Tampoco se devuelve el `set-cookie` del backend: ninguno de estos endpoints abre sesión. Las que
 * la abren (`/auth/*`) no pasan por aquí, van por el `rewrite`, que sí reenvía las cabeceras.
 */
export function cabecerasHaciaElBackend(request: Request): Headers {
  const cabeceras = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) cabeceras.set("content-type", contentType);
  const cookie = request.headers.get("cookie");
  if (cookie) cabeceras.set("cookie", cookie);
  return cabeceras;
}

export async function proxyToBackend(request: Request, path: string): Promise<Response> {
  const body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: cabecerasHaciaElBackend(request),
      body,
    });
  } catch {
    return new Response(JSON.stringify({ detail: "No se pudo contactar al backend." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
