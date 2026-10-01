"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTranscription } from "@/lib/transcribe";

/**
 * Entrada por voz para la caja del chat (solo preguntas, nunca comandos). Pulsar para grabar /
 * pulsar para detener (no mantener presionado). Al detener, transcribe y entrega el texto por
 * `onText` para que LLENE la caja editable — nunca se envía solo. Falla de forma visible: permiso
 * de micrófono negado, audio vacío o error de transcripción dejan un mensaje claro (nunca en
 * silencio ni insertando texto erróneo).
 */
export type VoiceStatus = "idle" | "recording" | "transcribing" | "error";

export function useVoiceInput(onText: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Al desmontar, corta cualquier captura activa (libera el micrófono).
  useEffect(() => () => stopTracks(), []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) {
          setError("No se captó audio. Intenta de nuevo.");
          setStatus("error");
          return;
        }
        setStatus("transcribing");
        try {
          const text = await fetchTranscription(blob);
          if (text.trim()) onText(text.trim());
          setStatus("idle");
        } catch {
          setError("No se pudo transcribir. Intenta de nuevo o escribe la pregunta.");
          setStatus("error");
        }
      };
      recorderRef.current = rec;
      rec.start();
      setStatus("recording");
    } catch {
      // Permiso negado o sin micrófono disponible.
      setError("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
      setStatus("error");
    }
  }, [onText]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop(); // dispara onstop → transcribe
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === "recording") stop();
    else if (status !== "transcribing") start();
  }, [status, start, stop]);

  return { status, error, toggle };
}
