"use client";

import { useCallback, useRef, useState } from "react";
import { fetchSuggestions, streamChat } from "@/lib/chat";
import type { ChatResponse, ChatTurn, Section, SectionContent } from "@/lib/types";

/**
 * Punto ÚNICO de la responsabilidad "chat" en el frontend (Hito 6): historial de sesión,
 * streaming de cada turno y caché/prefetch de preguntas sugeridas. El historial vive solo en
 * memoria (se pierde al recargar) — decisión temporal consciente: el futuro login traerá su
 * modelo de sesión/usuario y ESE hito reemplaza este almacenamiento. Aislarlo aquí hace que ese
 * cambio sea local (no hay historial disperso por los componentes).
 */

export interface OriginalSource {
  text: string | null;
  file: File | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string; // pregunta (user) o texto de la respuesta (assistant, en vivo o final)
  response?: ChatResponse; // assistant: se fija al terminar (contenido + ancla)
  status: "streaming" | "done" | "error";
}

/** Texto representativo de una respuesta, para el historial que viaja al modelo. */
function textOf(content: SectionContent, fallback: string): string {
  switch (content.content_type) {
    case "text":
      return content.text;
    case "table":
      return "[respuesta en tabla]";
    case "chart":
      return "[respuesta en gráfico]";
    case "timeline":
      return "[respuesta en línea de tiempo]";
    default:
      return fallback;
  }
}

export function useChat(original: OriginalSource | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "error">("idle");
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});

  const historyRef = useRef<ChatTurn[]>([]); // historial canónico que viaja al backend
  const requestedRef = useRef<Set<string>>(new Set()); // sugerencias ya pedidas (evita duplicados)
  const counterRef = useRef(0);
  const nextId = () => `m${counterRef.current++}`;

  // Nuevo documento → nuevo chat. Lo llama `page` desde el manejador de transformación (evento,
  // no render/efecto): así el reset es explícito y localizado en este hook.
  const reset = useCallback(() => {
    setMessages([]);
    setSuggestions({});
    setStatus("idle");
    historyRef.current = [];
    requestedRef.current = new Set();
  }, []);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || !original || status === "streaming") return;

      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "user", text: q, status: "done" },
        { id: assistantId, role: "assistant", text: "", status: "streaming" },
      ]);
      setStatus("streaming");

      const historySnapshot = historyRef.current;
      let acc = "";
      let response: ChatResponse | null = null;
      try {
        await streamChat(original.text, original.file, q, historySnapshot, (event) => {
          if (event.type === "text") {
            acc = event.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: event.text } : m)),
            );
          } else if (event.type === "done") {
            response = event.response;
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        });
        if (!response) throw new Error("La respuesta no llegó completa.");
        const finalResponse: ChatResponse = response;
        const answerText = textOf(finalResponse.content, acc);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, response: finalResponse, text: answerText, status: "done" }
              : m,
          ),
        );
        historyRef.current = [
          ...historySnapshot,
          { role: "user", text: q },
          { role: "assistant", text: answerText },
        ];
        setStatus("idle");
      } catch (error) {
        const message = error instanceof Error ? error.message : "La generación se interrumpió.";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: message, status: "error" } : m)),
        );
        setStatus("error");
      }
    },
    [original, status],
  );

  // Prefetch en segundo plano: al mostrar una sección en detalle, sus sugerencias se piden una
  // vez y se cachean → cuando el usuario mira, ya están (se sienten instantáneas).
  const prefetchSuggestions = useCallback(
    async (section: Section) => {
      if (!original || requestedRef.current.has(section.id)) return;
      requestedRef.current.add(section.id);
      const questions = await fetchSuggestions(original.text, original.file, section);
      setSuggestions((prev) => ({ ...prev, [section.id]: questions }));
    },
    [original],
  );

  return { messages, status, suggestions, send, prefetchSuggestions, reset };
}
