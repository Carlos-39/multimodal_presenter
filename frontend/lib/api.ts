import { anexaDocumento } from "./documentForm";
import type { OriginalSource } from "./types";
import type { TransformResponse } from "./types";

/**
 * Llama a POST /api/transform (multipart) con texto y/o archivo, y devuelve el envelope
 * {presentation, grounding}. Debe enviarse al menos uno de los dos.
 */
export async function postTransform(
  original: OriginalSource,
): Promise<TransformResponse> {
  const form = new FormData();
  anexaDocumento(form, original);

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
