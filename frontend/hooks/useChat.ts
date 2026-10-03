"use client";

import { useCallback, useRef, useState } from "react";
import type { MensajeGuardado } from "@/lib/account";
import { fetchSuggestions, streamChat } from "@/lib/chat";
import type {
  ChatResponse,
  ChatTurn,
  OriginalSource,
  Section,
  SectionContent,
} from "@/lib/types";

/**
 * Punto ÚNICO de la responsabilidad "chat" en el frontend (Hito 6): historial de sesión,
 * streaming de cada turno y caché/prefetch de preguntas sugeridas.
 *
 * El historial ya NO se pierde al recargar. La nota que había aquí decía que vivía solo en memoria
 * "hasta que exista login, y ESE hito reemplaza este almacenamiento"; el hito del login llegó y
 * esto es su parte. Haberlo tenido aislado en un hook es lo que hizo el cambio local: el hook
 * avisa de cada turno terminado y `page` decide si hay dónde guardarlo.
 *
 * Quién persiste y quién no está repartido así a propósito: este hook no sabe que existen cuentas
 * ni presentaciones guardadas. Sin cuenta nadie escucha el aviso y el chat se comporta igual que
 * antes, que es lo que exigen las sesiones de evaluación del Hito 8.
 *
 * Lo que NO se guarda, y es deliberado: los turnos que fallaron (un error de red no es parte de la
 * conversación) y las preguntas sugeridas (son una invitación, se vuelven a pedir y son baratas).
 */

export type { OriginalSource };

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

export function useChat(
  original: OriginalSource | null,
  { alTerminarTurno }: { alTerminarTurno?: (mensajes: MensajeGuardado[]) => void } = {},
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "streaming" | "error">("idle");
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});

  const historyRef = useRef<ChatTurn[]>([]); // historial canónico que viaja al backend
  // Lo mismo, en la forma en que se GUARDA: con la respuesta completa y su ancla. Se construye
  // turno a turno igual que `historyRef` en vez de derivarse de `messages`, y eso no es
  // duplicación: `messages` lleva también los turnos que fallaron, que no son conversación.
  const guardableRef = useRef<MensajeGuardado[]>([]);
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
    guardableRef.current = [];
    requestedRef.current = new Set();
  }, []);

  /**
   * Deja el chat como quedó en una presentación guardada.
   *
   * Los identificadores llevan prefijo `g` y los nuevos `m`: dos mensajes con la misma clave
   * hacen que React reconcilie el que no toca. Ya pasó una vez en el panel de fuente y los
   * visores se apilaban; no vale la pena volver a averiguarlo.
   */
  const restaurar = useCallback((guardados: MensajeGuardado[]) => {
    setMessages(
      guardados.map((m, i) => ({
        id: `g${i}`,
        role: m.rol,
        text: m.texto,
        response: m.respuesta ?? undefined,
        status: "done" as const,
      })),
    );
    historyRef.current = guardados.map((m) => ({ role: m.rol, text: m.texto }));
    guardableRef.current = guardados;
    setSuggestions({});
    setStatus("idle");
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
        await streamChat(
          original,
          q,
          historySnapshot,
          (event) => {
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
        guardableRef.current = [
          ...guardableRef.current,
          { rol: "user", texto: q },
          { rol: "assistant", texto: answerText, respuesta: finalResponse },
        ];
        setStatus("idle");
        // El aviso va DESPUÉS de fijar el estado: si guardar falla, lo que se ve en pantalla ya
        // es correcto. Quien escuche decide si hay dónde guardarlo; sin cuenta, nadie escucha.
        alTerminarTurno?.(guardableRef.current);
      } catch (error) {
        const message = error instanceof Error ? error.message : "La generación se interrumpió.";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: message, status: "error" } : m)),
        );
        setStatus("error");
      }
    },
    [original, status, alTerminarTurno],
  );

  // Prefetch en segundo plano: al mostrar una sección en detalle, sus sugerencias se piden una
  // vez y se cachean → cuando el usuario mira, ya están (se sienten instantáneas).
  const prefetchSuggestions = useCallback(
    async (section: Section) => {
      if (!original || requestedRef.current.has(section.id)) return;
      requestedRef.current.add(section.id);
      const questions = await fetchSuggestions(original, section);
      setSuggestions((prev) => ({ ...prev, [section.id]: questions }));
    },
    [original],
  );

  /**
   * El historial en la forma en que se guarda, leído en el momento de pedirlo.
   *
   * Es una función y no un valor porque se consulta al pulsar «Guardar», no al renderizar: lo
   * que hay que guardar es la conversación de ese instante.
   */
  const historialGuardable = useCallback(() => guardableRef.current, []);

  return {
    messages,
    status,
    suggestions,
    send,
    prefetchSuggestions,
    reset,
    restaurar,
    historialGuardable,
  };
}
