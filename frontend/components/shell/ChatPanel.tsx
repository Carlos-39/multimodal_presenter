"use client";

import { useEffect, useRef, useState } from "react";
import { ContentRenderer } from "@/components/content/ContentRenderer";
import type { ChatMessage } from "@/hooks/useChat";
import { track } from "@/lib/telemetry";
import type { GroundingStatus, SourceReference } from "@/lib/types";

/**
 * Chat anclado a fuentes (Hito 6). Reemplaza el placeholder del Hito 3.
 *
 * Stable Core Pattern: la ESTRUCTURA (header, lista, caja de input) es fija; solo el CONTENIDO
 * de los mensajes es dinámico. No reimplementa la convivencia de columnas (eso lo resuelve el
 * `Workspace`/`workspace.ts` del 5e); aquí solo se llena el panel.
 *
 * Cada respuesta se ancla a la fuente reusando `SourceReference` + el estado de grounding (5c):
 * si está anclada, muestra un chip que abre el `SourcePanel`; si no, lo dice con honestidad en
 * vez de fingir una fuente.
 */
interface ChatPanelProps {
  messages: ChatMessage[];
  status: "idle" | "streaming" | "error";
  onSend: (question: string) => void;
  suggestions: string[];
  onOpenSource: (source: SourceReference, status: GroundingStatus) => void;
  disabled: boolean; // sin documento aún
  activeSectionOrdinal: number | null; // telemetría (Hito 8): sección activa al preguntar
}

export function ChatPanel({
  messages,
  status,
  onSend,
  suggestions,
  onOpenSource,
  disabled,
  activeSectionOrdinal,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Autoscroll al último mensaje.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const streaming = status === "streaming";
  const canSend = !disabled && !streaming && input.trim().length > 0;

  // Telemetría (Hito 8): este es el ÚNICO punto que distingue una pregunta SUGERIDA de una
  // ESCRITA (el backend/`useChat` ya no pueden diferenciarlas). Solo metadatos: origen, posición
  // de la sugerencia y LONGITUD de la pregunta — nunca su texto (privacidad).
  function submit(question: string, origin: "suggested" | "typed", suggestionIndex?: number) {
    const q = question.trim();
    if (!q || disabled || streaming) return;
    if (origin === "suggested") {
      track("suggested_question_click", {
        section_ordinal: activeSectionOrdinal,
        suggestion_index: suggestionIndex ?? -1,
        question_len: q.length,
      });
    } else {
      track("typed_question_submit", {
        section_ordinal: activeSectionOrdinal,
        question_len: q.length,
      });
    }
    onSend(q);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <h2 className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Chat
      </h2>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">
            {disabled
              ? "Transforma un documento para conversar sobre él."
              : "Pregunta sobre el documento. Cada respuesta se ancla a su fuente."}
          </p>
        ) : (
          messages.map((message) => <Message key={message.id} message={message} onOpenSource={onOpenSource} />)
        )}
      </div>

      {suggestions.length > 0 ? (
        <div className="border-t border-border px-4 py-2">
          <p className="mb-1.5 text-xs text-muted">Preguntas sugeridas</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((question, index) => (
              <button
                key={question}
                type="button"
                onClick={() => submit(question, "suggested", index)}
                disabled={disabled || streaming}
                className="rounded-full border border-border px-2.5 py-1 text-left text-xs text-foreground transition-[colors,transform] hover:border-accent hover:bg-accent/5 hover:text-accent active:scale-[0.97] disabled:opacity-40"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input, "typed");
        }}
        className="border-t border-border p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input, "typed");
              }
            }}
            rows={1}
            disabled={disabled}
            placeholder={disabled ? "Sin documento…" : "Escribe una pregunta…"}
            className="max-h-28 min-h-9 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent"
          >
            {streaming ? "…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Message({
  message,
  onOpenSource,
}: {
  message: ChatMessage;
  onOpenSource: (source: SourceReference, status: GroundingStatus) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="section-enter flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="section-enter rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning">
        {message.text}
      </div>
    );
  }

  const response = message.response;
  const isComponent = response && response.content.content_type !== "text";

  return (
    <div className="section-enter rounded-lg border border-border bg-background px-3 py-2">
      {isComponent ? (
        <ContentRenderer content={response.content} />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {message.text}
          {message.status === "streaming" ? <span className="animate-pulse">▋</span> : null}
        </p>
      )}

      {message.status === "done" && response ? (
        <SourceChip response={response} onOpenSource={onOpenSource} />
      ) : null}
    </div>
  );
}

function SourceChip({
  response,
  onOpenSource,
}: {
  response: NonNullable<ChatMessage["response"]>;
  onOpenSource: (source: SourceReference, status: GroundingStatus) => void;
}) {
  const { source, grounding } = response;

  // No anclada: se dice con honestidad, no se inventa una fuente (mismo espíritu que not_found 5c).
  if (!source || grounding === "not_found") {
    return (
      <p className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-warning">
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
        Respuesta no anclada a la fuente
      </p>
    );
  }

  const label =
    grounding === "unverified" && source.page
      ? `Fuente: página ${source.page}`
      : `Fuente: “${truncate(source.quote)}”`;

  return (
    <button
      type="button"
      onClick={() => onOpenSource(source, grounding)}
      className="mt-2 border-t border-border pt-2 text-left text-xs text-muted hover:text-foreground"
    >
      {label} · ver en el documento
    </button>
  );
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
