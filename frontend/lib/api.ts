import type { TransformResponse } from "./types";

/**
 * Llama a POST /api/transform (proxy a /transform del backend) y devuelve el envelope
 * completo {presentation, grounding}. Lanza Error con un mensaje legible si falla.
 */
export async function postTransform(text: string): Promise<TransformResponse> {
  const res = await fetch("/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      // respuesta sin cuerpo JSON; se queda con el mensaje por código de estado.
    }
    throw new Error(detail);
  }

  return (await res.json()) as TransformResponse;
}
