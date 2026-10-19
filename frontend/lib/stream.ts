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
 * Entrega los eventos de una respuesta SSE, llegue por partes o de una sola pieza.
 *
 * **Lo de "una sola pieza" no es un caso teórico: es el navegador de dentro de WhatsApp.** Los
 * webviews embebidos no siempre exponen `response.body`, así que no hay `getReader()` y la
 * respuesta solo se puede leer entera, al final. Antes eso se trataba como un fallo (`!res.body`
 * lanzaba aunque el HTTP fuera 200) y costaba caro de dos maneras: el chat moría con «La
 * generación se interrumpió», y la transformación caía al endpoint no-streaming, que **vuelve a
 * generar desde cero**. O sea, pagar dos veces la misma presentación por abrir el enlace desde un
 * chat, que es exactamente como van a llegar los participantes.
 *
 * Leída entera se pierde el efecto de escritura en vivo, y nada más: llegan los mismos eventos,
 * en el mismo orden y con el mismo contenido.
 */
export async function entregaSSE<T>(res: Response, onEvent: (event: T) => void): Promise<void> {
  if (!res.body) {
    const texto = await res.text();
    const completo = texto.endsWith("\n\n") ? texto : texto + "\n\n";
    for (const event of parseSSE<T>(completo).events) onEvent(event);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSSE<T>(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) onEvent(event);
  }
  // Vaciar cualquier evento final que quede en el buffer.
  const tail = parseSSE<T>(buffer.endsWith("\n\n") ? buffer : buffer + "\n\n");
  for (const event of tail.events) onEvent(event);
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
  // Solo el estado HTTP decide si esto es un fallo. Que no venga `body` NO lo es: ver `entregaSSE`.
  if (!res.ok) {
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

  await entregaSSE<StreamEvent>(res, onEvent);
}
