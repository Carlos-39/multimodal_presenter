"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleNotch, Microphone, Question, Stop } from "@phosphor-icons/react";
import { ContentRenderer } from "@/components/content/ContentRenderer";
import { SkeletonText } from "@/components/content/Skeleton";
import { SourceCitation, UnanchoredNotice } from "@/components/content/SourceCitation";
import type { ChatMessage } from "@/hooks/useChat";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { track } from "@/lib/telemetry";
import type { CitedRegion, GroundingStatus, SourceReference } from "@/lib/types";

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
  onOpenSource: (
    source: SourceReference,
    status: GroundingStatus,
    startS: number | null,
    region: CitedRegion | null,
  ) => void;
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
      <h2 className="border-b border-border px-4 py-3 text-[0.8125rem] font-medium leading-4 text-foreground">
        Chat
      </h2>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="px-2 pt-6 text-center text-[0.8125rem] leading-5 text-muted">
            {disabled
              ? "Transforma un documento para conversar sobre él."
              : "Pregunta sobre el documento. Cada respuesta se ancla a su fuente."}
          </p>
        ) : (
          messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              onOpenSource={onOpenSource}
              onAsk={(question) => submit(question, "typed")}
              canAsk={!disabled && !streaming}
            />
          ))
        )}
      </div>

      {suggestions.length > 0 ? (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-xs text-muted">Preguntas sugeridas</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((question, index) => (
              <button
                key={question}
                type="button"
                onClick={() => submit(question, "suggested", index)}
                disabled={disabled || streaming}
                className="rounded-full border border-border px-2.5 py-1 text-left text-xs text-foreground-secondary transition-[colors,transform] hover:border-accent hover:bg-accent-subtle hover:text-accent active:scale-[0.97] disabled:opacity-40"
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
                : "border-border text-muted hover:border-border-strong hover:text-foreground"
            }`}
          >
            {voice.status === "transcribing" ? (
              <CircleNotch size={16} className="animate-spin" aria-hidden />
            ) : voice.status === "recording" ? (
              <Stop size={14} weight="fill" aria-hidden />
            ) : (
              <Microphone size={16} aria-hidden />
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
            placeholder={disabled ? "Aún no hay documento" : "Haz una pregunta"}
            className="max-h-28 min-h-9 flex-1 resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="flex h-9 shrink-0 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:opacity-45 disabled:hover:bg-accent"
          >
            {streaming ? <CircleNotch size={16} className="animate-spin" aria-label="Respondiendo" /> : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Message({
  message,
  onOpenSource,
  onAsk,
  canAsk,
}: {
  message: ChatMessage;
  onOpenSource: (
    source: SourceReference,
    status: GroundingStatus,
    startS: number | null,
    region: CitedRegion | null,
  ) => void;
  onAsk: (question: string) => void;
  canAsk: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="section-enter flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-accent-subtle px-3 py-2 text-sm leading-5 text-foreground">
          {message.text}
        </p>
      </div>
    );
  }

  if (message.status === "error") {
    return (
      <div className="section-enter rounded-lg border border-warning/40 px-3 py-2 text-sm leading-5 text-warning">
        {message.text}
      </div>
    );
  }

  const response = message.response;
  const clarification = message.status === "done" ? response?.clarification : null;

  // Opción D: pedido de aclaración. Estado visual propio (acento), nunca bloquea el chat: las
  // opciones son un atajo y el usuario siempre puede reescribir abajo.
  if (clarification) {
    return (
      <div className="section-enter rounded-lg border border-accent/40 bg-accent-subtle px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
          <Question size={14} aria-hidden />
          Para responder mejor
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {clarification.question}
        </p>
        {(clarification.options ?? []).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(clarification.options ?? []).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onAsk(option)}
                disabled={!canAsk}
                className="rounded-full border border-accent/50 bg-surface px-2.5 py-1 text-left text-xs text-accent transition-[colors,transform] hover:bg-accent hover:text-accent-foreground active:scale-[0.97] disabled:opacity-40"
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const isComponent = response && response.content.content_type !== "text";

  return (
    <div className="section-enter rounded-lg border border-border bg-background px-3 py-2.5 [--table-bg:var(--background)]">
      {isComponent ? (
        <ContentRenderer content={response.content} />
      ) : message.status === "streaming" && message.text.length === 0 ? (
        // Aún no llega el primer fragmento: el hueco de la respuesta, no una burbuja vacía.
        <div role="status">
          <span className="sr-only">Buscando la respuesta en el documento…</span>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {message.text}
          {message.status === "streaming" ? (
            <span
              className="ml-0.5 inline-block h-[1em] w-[0.45em] translate-y-[0.15em] animate-pulse rounded-[1px] bg-accent"
              aria-hidden
            />
          ) : null}
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
  onOpenSource: (
    source: SourceReference,
    status: GroundingStatus,
    startS: number | null,
    region: CitedRegion | null,
  ) => void;
}) {
  const { source, grounding } = response;
  const startS = response.start_s ?? null;
  const region = response.region ?? null;

  // No anclada: se dice con honestidad, no se inventa una fuente (mismo espíritu que not_found 5c).
  if (!source || grounding === "not_found") {
    return (
      <div className="mt-2.5 border-t border-border pt-2">
        <UnanchoredNotice>Respuesta no anclada a la fuente</UnanchoredNotice>
      </div>
    );
  }

  const byPage = grounding === "unverified" && source.page;

  return (
    <div className="mt-2.5 border-t border-border pt-2">
      <SourceCitation onOpen={() => onOpenSource(source, grounding, startS, region)} quoted={!byPage} action="ver">
        {byPage ? `página ${source.page}` : truncate(source.quote)}
      </SourceCitation>
    </div>
  );
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
