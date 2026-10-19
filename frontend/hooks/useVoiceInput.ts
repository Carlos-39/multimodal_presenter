"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTranscription } from "@/lib/transcribe";

/**
 * Entrada por voz para la caja del chat (solo preguntas, nunca comandos). Pulsar para grabar /
 * pulsar para detener (no mantener presionado). Al detener, transcribe y entrega el texto por
 * `onText` para que LLENE la caja editable, nunca se envía solo. Falla de forma visible: permiso
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
  // El análisis del nivel vive aquí y no en el control, porque aquí es donde ya está el flujo del
  // micrófono: el dibujo solo pregunta «¿cuánto suena?» y no necesita saber nada de permisos.
  const audioRef = useRef<{
    ctx: AudioContext;
    analizador: AnalyserNode;
    buf: Uint8Array<ArrayBuffer>;
  } | null>(null);

  // En `useCallback` para que las dependencias de abajo sean honestas en vez de silenciadas.
  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioRef.current?.ctx.close().catch(() => {});
    audioRef.current = null;
  }, []);

  /**
   * Cuánto suena ahora mismo, de 0 a 1. Devuelve 0 si no se está grabando o si el navegador no
   * da `AudioContext`: el dibujo se queda plano, que es honesto, en vez de inventar movimiento.
   */
  const nivel = useCallback(() => {
    const a = audioRef.current;
    if (!a) return 0;
    a.analizador.getByteFrequencyData(a.buf);
    // Solo las bandas graves y medias: ahí está la voz, y así el siseo de fondo no llena la onda.
    let suma = 0;
    const hasta = Math.min(36, a.buf.length);
    for (let i = 1; i < hasta; i++) suma += a.buf[i];
    return Math.min(1, suma / ((hasta - 1) * 255) * 2.4);
  }, []);

  // Al desmontar, corta cualquier captura activa (libera el micrófono).
  useEffect(() => () => stopTracks(), [stopTracks]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // El analizador es OPCIONAL: si el navegador no lo soporta, se graba igual y la onda se
      // queda plana. Nunca se impide grabar por no poder dibujar.
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const analizador = ctx.createAnalyser();
          analizador.fftSize = 256;
          analizador.smoothingTimeConstant = 0.7;
          ctx.createMediaStreamSource(stream).connect(analizador);
          audioRef.current = { ctx, analizador, buf: new Uint8Array(new ArrayBuffer(analizador.frequencyBinCount)) };
        }
      } catch {
        audioRef.current = null;
      }

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
  }, [onText, stopTracks]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop(); // dispara onstop → transcribe
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === "recording") stop();
    else if (status !== "transcribing") start();
  }, [status, start, stop]);

  return { status, error, toggle, nivel };
}
