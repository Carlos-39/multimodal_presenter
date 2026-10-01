"use client";

import { useCallback, useRef, useState } from "react";
import type { Section } from "@/lib/types";

/**
 * Narración tipo audiolibro (Hito 5g Parte 3). Punto ÚNICO de la responsabilidad "audio":
 * pide el mp3 a POST /api/narration (guion Sonnet + TTS OpenAI en el backend), lo reproduce y lo
 * cachea por documento (no re-pide si se vuelve a reproducir el mismo contenido).
 *
 * Independiente del toggle resumen/detallado y de la sección activa: narra los núcleos como
 * columna vertebral; cambiar de sección NO afecta la reproducción. Solo se reinicia con un
 * documento nuevo (lo llama `page` desde el manejador de transformación). Nunca autoplay.
 * Si el TTS falla, el estado pasa a `error` y el control lo muestra (honestidad), nunca mudo.
 */
export type NarrationStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface NarrationInput {
  title: string;
  sections: Section[];
}

export function useNarration(presentation: NarrationInput) {
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<{ key: string; url: string } | null>(null);

  const available = presentation.sections.length > 0;
  // Clave de contenido: título + ids de sección. Cambia con un documento nuevo, no al togglear
  // detalle (que no modifica `sections`) ni al navegar entre secciones.
  const key = `${presentation.title}::${presentation.sections.map((s) => s.id).join(",")}`;

  const reset = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (cacheRef.current) {
      URL.revokeObjectURL(cacheRef.current.url);
      cacheRef.current = null;
    }
    setStatus("idle");
  }, []);

  const play = useCallback(async () => {
    if (status === "playing" || !available) return;

    // Reusar el audio ya cargado para este mismo contenido (caché; no re-pide).
    if (cacheRef.current?.key === key && audioRef.current) {
      if (audioRef.current.ended) audioRef.current.currentTime = 0;
      try {
        await audioRef.current.play();
        setStatus("playing");
      } catch {
        setStatus("error");
      }
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presentation }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();

      if (cacheRef.current) URL.revokeObjectURL(cacheRef.current.url);
      const url = URL.createObjectURL(blob);
      cacheRef.current = { key, url };

      const audio = new Audio(url);
      audio.onended = () => setStatus("paused");
      audio.onerror = () => setStatus("error");
      audioRef.current = audio;
      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  }, [presentation, key, status, available]);

  const pause = useCallback(() => {
    if (audioRef.current && status === "playing") {
      audioRef.current.pause();
      setStatus("paused");
    }
  }, [status]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setStatus("paused");
  }, []);

  return { status, available, play, pause, stop, reset };
}
