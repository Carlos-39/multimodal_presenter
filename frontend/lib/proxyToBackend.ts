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

export async function proxyToBackend(request: Request, path: string): Promise<Response> {
  const contentType = request.headers.get("content-type");
  const body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: contentType ? { "content-type": contentType } : undefined,
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
