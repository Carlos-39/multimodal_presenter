/**
 * Proxy en STREAMING hacia el backend para el SSE de /transform/stream (Hito 5d).
 *
 * Por qué existe (y no basta el rewrite de next.config): el `rewrites()` de Next BUFFERIZA
 * la respuesta del backend y la entrega de golpe, así que las secciones no llegan una por una
 * al navegador aunque el backend sí las emita incrementalmente (verificado: backend directo
 * trocea; a través del rewrite, todo llega en el mismo instante). Un Route Handler que
 * devuelve el `ReadableStream` del upstream tal cual (`new Response(upstream.body)`) sí
 * reenvía el stream sin aplanarlo.
 *
 * Como las rutas del filesystem tienen precedencia sobre los rewrites `afterFiles`, este
 * handler intercepta SOLO /api/transform/stream; el resto de /api/* sigue por el rewrite.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request): Promise<Response> {
  // El cuerpo multipart es pequeño y ya está disponible; lo reenviamos crudo (con su
  // content-type + boundary) para no re-encodificar. Lo que importa transmitir en vivo es la
  // RESPUESTA, no la petición.
  const contentType = request.headers.get("content-type") ?? "";
  const body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/transform/stream`, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
  } catch {
    // Backend caído/inaccesible → 502 para que el cliente caiga al endpoint no-streaming.
    return new Response(JSON.stringify({ detail: "No se pudo contactar al backend." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  // Errores de validación (400/413/415): se reenvían tal cual (JSON), el cliente los lee.
  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  }

  // Éxito: reenviar el ReadableStream del SSE sin bufferizar.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no", // desactiva buffering en proxies intermedios (p. ej. nginx)
    },
  });
}
