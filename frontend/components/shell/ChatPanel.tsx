"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContentRenderer } from "@/components/content/ContentRenderer";
import type { ChatMessage } from "@/hooks/useChat";
import { useVoiceInput } from "@/hooks/useVoiceInput";
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

  // Entrada por voz: la transcripción LLENA la caja (editable), nunca se envía sola.
  const handleTranscribed = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const voice = useVoiceInput(handleTranscribed);

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
        {/* Estado/errores de la voz: siempre visibles (honestidad), nunca falla en silencio. */}
        {voice.status === "recording" ? (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-warning">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-warning" aria-hidden />
            Grabando… pulsa el micrófono para detener.
          </p>
        ) : voice.status === "transcribing" ? (
          <p className="mb-2 text-xs text-muted">Transcribiendo…</p>
        ) : voice.status === "error" && voice.error ? (
          <p className="mb-2 text-xs text-warning">{voice.error}</p>
        ) : null}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={voice.toggle}
            disabled={disabled || voice.status === "transcribing"}
            aria-label={voice.status === "recording" ? "Detener grabación" : "Grabar pregunta por voz"}
            aria-pressed={voice.status === "recording"}
            title="Preguntar por voz"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors active:scale-95 disabled:opacity-40 ${
              voice.status === "recording"
                ? "animate-pulse border-warning text-warning"
                : "border-border text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {voice.status === "transcribing" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-accent" />
            ) : voice.status === "recording" ? (
              <StopDot />
            ) : (
              <MicIcon />
            )}
          </button>

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
            placeholder={disabled ? "Sin documento…" : "Escribe o dicta una pregunta…"}
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

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5a2 2 0 0 0-2 2v4a2 2 0 1 0 4 0v-4a2 2 0 0 0-2-2Z" />
      <path d="M4 7a.6.6 0 0 1 1.2 0 2.8 2.8 0 0 0 5.6 0A.6.6 0 0 1 12 7a4 4 0 0 1-3.4 3.96V13h1.6a.6.6 0 0 1 0 1.2H5.8a.6.6 0 0 1 0-1.2h1.6v-2.04A4 4 0 0 1 4 7Z" />
    </svg>
  );
}

function StopDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
    </svg>
  );
}
