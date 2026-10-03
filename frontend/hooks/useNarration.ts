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
 *
 * Con una presentación guardada la caché se precarga con la narración ya generada, así que
 * escucharla no vuelve a pasar por el TTS. No es solo el ahorro: la voz lee un guion nuevo cada
 * vez que se regenera, y una presentación guardada que suena distinta al volver no era la misma.
 *
 * Este hook no sabe que existen cuentas: avisa de qué audio acaba de generar y `page` decide si
 * hay dónde guardarlo. Sin cuenta nadie escucha y todo sigue como antes.
 */
export type NarrationStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface NarrationInput {
  title: string;
  sections: Section[];
}

/** Salto de los botones de adelantar/retroceder, en segundos (convención de audiolibro). */
export const NARRATION_SKIP_S = 15;

/**
 * Clave de contenido: título + ids de sección. Cambia con un documento nuevo, no al togglear
 * detalle (que no modifica `sections`) ni al navegar entre secciones.
 *
 * Está fuera del hook porque `restaurar` la necesita para la presentación que ACABA de llegar,
 * cuando el estado del componente todavía habla de la anterior.
 */
export function claveDeNarracion(pres: NarrationInput): string {
  return `${pres.title}::${pres.sections.map((s) => s.id).join(",")}`;
}

export function useNarration(
  presentation: NarrationInput,
  { alGenerar }: { alGenerar?: (audio: Blob) => void } = {},
) {
  const [status, setStatus] = useState<NarrationStatus>("idle");
  // Posición y duración, para que el control pueda mostrar el tiempo y permitir saltar a un
  // punto concreto. Sin esto la narración solo se podía reproducir y pausar: si el oyente se
  // perdía algo, no tenía forma de volver atrás.
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // `esObjeto` distingue el audio recién generado (object URL, hay que liberarlo) del guardado
  // (una ruta del servidor, que no se libera). Revocar lo segundo no rompe nada hoy, pero es
  // decirle al navegador que suelte algo que nunca le pidió.
  // `audio` solo está cuando se acaba de generar: es lo que hace falta para subirlo si alguien
  // pulsa «Guardar» DESPUÉS de haberlo escuchado. El restaurado no lo lleva porque ya está
  // guardado en el servidor, que es de donde viene.
  const cacheRef = useRef<{
    key: string;
    url: string;
    esObjeto: boolean;
    audio?: Blob;
  } | null>(null);

  const available = presentation.sections.length > 0;
  const key = claveDeNarracion(presentation);

  const reset = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (cacheRef.current?.esObjeto) URL.revokeObjectURL(cacheRef.current.url);
    cacheRef.current = null;
    setStatus("idle");
    setCurrentTime(0);
    setDuration(0);
  }, []);

  /** Engancha los eventos de posición al <audio> recién creado. */
  const seguirPosicion = useCallback((audio: HTMLAudioElement) => {
    const sincronizar = () => setCurrentTime(audio.currentTime);
    audio.addEventListener("timeupdate", sincronizar);
    audio.addEventListener("seeked", sincronizar);
    audio.addEventListener("loadedmetadata", () => {
      // Un mp3 de TTS puede no traer duración hasta tener metadatos; `Infinity` no sirve
      // para pintar una barra, así que solo se acepta un número finito.
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    });
    audio.addEventListener("durationchange", () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    });
  }, []);

  /** Mueve la reproducción a un segundo concreto (barra de progreso y saltos). */
  const seek = useCallback((segundos: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const destino = Math.min(Math.max(segundos, 0), audio.duration);
    audio.currentTime = destino;
    setCurrentTime(destino);
  }, []);

  /** Adelanta o retrocede desde donde esté (negativo = atrás). */
  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (audio) seek(audio.currentTime + delta);
    },
    [seek],
  );

  /** Prepara un `<audio>` para una URL y lo deja listo para sonar. Quien llama lo guarda. */
  const montarAudio = useCallback(
    (url: string) => {
      const audio = new Audio(url);
      audio.onended = () => setStatus("paused");
      audio.onerror = () => setStatus("error");
      seguirPosicion(audio);
      return audio;
    },
    [seguirPosicion],
  );

  /**
   * Apunta la caché a una narración YA generada que vive en el servidor.
   *
   * No descarga nada: solo deja dicho de dónde sacarla si alguien pulsa. Restaurar una
   * presentación no debería traerse un mp3 que quizá nadie escuche.
   *
   * La clave se calcula de la presentación que se pasa, no del estado del componente: al
   * restaurar, el estado todavía describe la presentación anterior.
   */
  const restaurar = useCallback((url: string, pres: NarrationInput) => {
    audioRef.current?.pause();
    audioRef.current = null;
    cacheRef.current = { key: claveDeNarracion(pres), url, esObjeto: false };
    setStatus("idle");
    setCurrentTime(0);
    setDuration(0);
  }, []);

  /**
   * El mp3 que se acaba de generar, si lo hay, leído en el momento de pedirlo.
   *
   * Es para subirlo cuando alguien pulsa «Guardar» DESPUÉS de haber escuchado la narración: sin
   * esto, guardar justo después de generarla la dejaría fuera y habría que pagar el TTS otra vez
   * —y sonaría distinta, que es lo que de verdad molesta.
   */
  const audioGenerado = useCallback(() => cacheRef.current?.audio ?? null, []);

  const play = useCallback(async () => {
    if (status === "playing" || !available) return;

    // Reusar lo que ya hay para este mismo contenido: el audio recién generado o el que se
    // restauró con la presentación. En el segundo caso el `<audio>` se monta ahora, en el primer
    // play, que es cuando de verdad hace falta descargarlo.
    if (cacheRef.current?.key === key) {
      if (audioRef.current === null) audioRef.current = montarAudio(cacheRef.current.url);
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

      if (cacheRef.current?.esObjeto) URL.revokeObjectURL(cacheRef.current.url);
      const url = URL.createObjectURL(blob);
      cacheRef.current = { key, url, esObjeto: true, audio: blob };

      const audio = montarAudio(url);
      audioRef.current = audio;
      await audio.play();
      setStatus("playing");
      // Después de que suene: si guardarla falla, lo que el oyente tiene ya está bien.
      alGenerar?.(blob);
    } catch {
      setStatus("error");
    }
  }, [presentation, key, status, available, montarAudio, alGenerar]);

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
    setCurrentTime(0);
    // `idle`, no `paused`: detener devuelve al principio, así que el control debe decir
    // "Pulsa para escuchar" y no "En pausa" con el reloj en 0:00. El audio sigue cacheado —
    // `play` lo reusa por `cacheRef`, sin volver a pedirlo al TTS.
    setStatus("idle");
  }, []);

  return {
    status,
    available,
    currentTime,
    duration,
    play,
    pause,
    stop,
    seek,
    skip,
    reset,
    restaurar,
    audioGenerado,
  };
}
