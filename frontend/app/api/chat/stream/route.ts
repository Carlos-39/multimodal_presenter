/**
 * Proxy en STREAMING hacia el backend para el SSE de /chat/stream (Hito 6).
 *
 * Mismo motivo que el route handler de /transform/stream (5d): el `rewrites()` de Next
 * BUFFERIZA el SSE y lo entrega de golpe, lo que arruinaría el efecto de escritura en vivo del
 * chat. Este handler devuelve el `ReadableStream` del backend tal cual, sin aplanarlo. Como las
 * rutas del filesystem tienen precedencia sobre los rewrites `afterFiles`, intercepta SOLO
 * /api/chat/stream; el resto de /api/* (incluido /chat/suggestions, que es request/response)
 * sigue por el rewrite.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  const body = await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}/chat/stream`, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
  } catch {
    return new Response(JSON.stringify({ detail: "No se pudo contactar al backend." }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  // Errores de validación (400): se reenvían tal cual (JSON) para que el cliente los lea.
  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
