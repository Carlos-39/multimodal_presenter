import type { TransformResponse } from "./types";

/**
 * Llama a POST /api/transform (multipart) con texto y/o archivo, y devuelve el envelope
 * {presentation, grounding}. Debe enviarse al menos uno de los dos.
 */
export async function postTransform(
  text: string | null,
  file: File | null,
): Promise<TransformResponse> {
  const form = new FormData();
  if (text && text.trim().length > 0) form.append("text", text.trim());
  if (file) form.append("file", file);

  const res = await fetch("/api/transform", { method: "POST", body: form });

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
      // sin cuerpo JSON; se queda con el mensaje por código de estado.
    }
    throw new Error(detail);
  }

  return (await res.json()) as TransformResponse;
}
