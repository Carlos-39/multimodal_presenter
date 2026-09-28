import { parseSSE } from "./stream";
import type { ChatStreamEvent, ChatTurn, Section } from "./types";

/**
 * Llama a POST /api/chat/stream y entrega cada evento SSE a `onEvent`.
 * Envía el documento original (texto y/o archivo) en cada turno — el chat RELEE el documento
 * (Hito 6); el backend lo cachea (prompt caching) para no reprocesarlo. Lanza si el HTTP no es OK.
 */
export async function streamChat(
  text: string | null,
  file: File | null,
  question: string,
  history: ChatTurn[],
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const form = new FormData();
  if (text && text.trim().length > 0) form.append("text", text.trim());
  if (file) form.append("file", file);
  form.append("question", question);
  form.append("history", JSON.stringify(history));

  const res = await fetch("/api/chat/stream", { method: "POST", body: form });
  if (!res.ok || !res.body) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
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
    const parsed = parseSSE<ChatStreamEvent>(buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) onEvent(event);
  }
  const tail = parseSSE<ChatStreamEvent>(buffer.endsWith("\n\n") ? buffer : buffer + "\n\n");
  for (const event of tail.events) onEvent(event);
}

/**
 * Pide preguntas sugeridas específicas a una sección (POST /api/chat/suggestions).
 * Devuelve [] ante cualquier fallo (las sugerencias son una invitación, no deben romper nada).
 */
export async function fetchSuggestions(
  text: string | null,
  file: File | null,
  section: Section,
): Promise<string[]> {
  const form = new FormData();
  if (text && text.trim().length > 0) form.append("text", text.trim());
  if (file) form.append("file", file);
  form.append("section", JSON.stringify(section));

  try {
    const res = await fetch("/api/chat/suggestions", { method: "POST", body: form });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.questions) ? (body.questions as string[]) : [];
  } catch {
    return [];
  }
}
