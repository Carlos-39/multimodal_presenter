import { anexaDocumento } from "./documentForm";
import type { OriginalSource } from "./types";
import type { StreamEvent } from "./types";

/**
 * Parsea un buffer de texto SSE acumulado en eventos + el resto incompleto. Puro y testeable.
 * Los eventos se separan por línea en blanco; cada uno lleva una línea `data: {json}`.
 */
export function parseSSE<T = StreamEvent>(buffer: string): { events: T[]; rest: string } {
  const events: T[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? ""; // el último tramo puede estar incompleto
  for (const part of parts) {
    const line = part.split("\n").find((l) => l.startsWith("data:"));
    if (!line) continue;
    const json = line.slice(5).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as T);
    } catch {
      // evento mal formado: se ignora en lugar de romper el stream.
    }
  }
  return { events, rest };
}

/**
 * Llama a POST /api/transform/stream y entrega cada evento SSE a `onEvent`.
 * Lanza si la conexión falla o el estado HTTP no es OK (para que el llamador pueda caer al
 * endpoint no-streaming). Un fallo a mitad del stream llega como evento `error`.
 */
export async function streamTransform(
  original: OriginalSource,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const form = new FormData();
  anexaDocumento(form, original);

  const res = await fetch("/api/transform/stream", { method: "POST", body: form });
  if (!res.ok || !res.body) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // sin cuerpo JSON
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSSE(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) onEvent(event);
  }
  // Vaciar cualquier evento final que quede en el buffer.
  const tail = parseSSE(buffer.endsWith("\n\n") ? buffer : buffer + "\n\n");
  for (const event of tail.events) onEvent(event);
}
