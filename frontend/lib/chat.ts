import { anexaDocumento } from "./documentForm";
import { entregaSSE } from "./stream";
import type { ChatStreamEvent, ChatTurn, OriginalSource, Section } from "./types";

/**
 * Llama a POST /api/chat/stream y entrega cada evento SSE a `onEvent`.
 * Envía el documento original (texto y/o archivo) en cada turno — el chat RELEE el documento
 * (Hito 6); el backend lo cachea (prompt caching) para no reprocesarlo. Lanza si el HTTP no es OK.
 */
export async function streamChat(
  original: OriginalSource,
  question: string,
  history: ChatTurn[],
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const form = new FormData();
  anexaDocumento(form, original);
  if (original.audioEvidence) form.append("audio_evidence", original.audioEvidence);
  form.append("question", question);
  form.append("history", JSON.stringify(history));

  const res = await fetch("/api/chat/stream", { method: "POST", body: form });
  // Igual que en la transformación: que no venga `body` no es un fallo, es un webview embebido.
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      // sin cuerpo JSON
    }
    throw new Error(detail);
  }

  await entregaSSE<ChatStreamEvent>(res, onEvent);
}

/**
 * Pide preguntas sugeridas específicas a una sección (POST /api/chat/suggestions).
 * Devuelve [] ante cualquier fallo (las sugerencias son una invitación, no deben romper nada).
 */
export async function fetchSuggestions(
  original: OriginalSource,
  section: Section,
): Promise<string[]> {
  const form = new FormData();
  anexaDocumento(form, original);
  if (original.audioEvidence) form.append("audio_evidence", original.audioEvidence);
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
