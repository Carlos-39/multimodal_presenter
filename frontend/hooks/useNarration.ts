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
 *
 * ## Por qué hay UN solo `<audio>` y por qué empieza sonando en silencio
 *
 * En iOS (y por tanto en el navegador de WhatsApp, que es por donde llegan los participantes) un
 * `play()` solo se permite si sale del toque del dedo. Generar la narración tarda unos veinte
 * segundos, así que cuando el mp3 llegaba, el permiso del toque hacía rato que había caducado y
 * el navegador bloqueaba la reproducción. El `catch` metía ese bloqueo en el mismo saco que un
 * fallo del TTS y decía «no se pudo generar la narración»: el audio estaba generado y pagado, y
 * el mensaje mandaba a buscar donde no era. Lo vimos en producción.
 *
 * Por eso dos cosas. Primera: el elemento se crea UNA vez y se reusa toda la sesión, en lugar de
 * un `new Audio(url)` por reproducción, el desbloqueo se concede al elemento, así que uno nuevo
 * nace bloqueado otra vez. Segunda: en cuanto se pulsa, y antes de pedir nada, ese elemento
 * reproduce un milisegundo de silencio. Eso ocurre todavía dentro del toque, que es lo único que
 * el navegador mira, y deja el elemento desbloqueado para cuando el mp3 llegue.
 *
 * Si aun así el navegador se niega, el estado es `ready` y no `error`: la narración está hecha y
 * suena con el siguiente toque. Decir «no se pudo generar» cuando sí se generó es mentir sobre
 * dónde está el problema, y eso cuesta más que el fallo.
 *
 * Con una presentación guardada la caché se precarga con la narración ya generada, así que
 * escucharla no vuelve a pasar por el TTS. No es solo el ahorro: la voz lee un guion nuevo cada
 * vez que se regenera, y una presentación guardada que suena distinta al volver no era la misma.
 *
 * Este hook no sabe que existen cuentas: avisa de qué audio acaba de generar y `page` decide si
 * hay dónde guardarlo. Sin cuenta nadie escucha y todo sigue como antes.
 */
export type NarrationStatus = "idle" | "loading" | "playing" | "paused" | "ready" | "error";

interface NarrationInput {
  title: string;
  sections: Section[];
}

/** Salto de los botones de adelantar/retroceder, en segundos (convención de audiolibro). */
export const NARRATION_SKIP_S = 15;

/**
 * Un milisegundo de silencio: WAV PCM de 44,1 kHz, mono, 16 bits. Son 132 bytes y se construyen
 * aquí, sin pedir nada a la red: tiene que estar disponible en el mismo instante del toque, y
 * cualquier cosa que haya que ir a buscar llega tarde.
 *
 * Se sirve como `blob:` y no como `data:` por la CSP de la aplicación: `media-src` admite `'self'`
 * y `blob:` (que ya hacían falta para el mp3 de la narración) pero no `data:`, así que un
 * `data:audio/wav` se rechaza con `NotSupportedError` antes de sonar. Medido contra la cabecera
 * real, no supuesto. La alternativa era ensanchar la política para 132 bytes de silencio.
 *
 * 16 bits a 44,1 kHz y no algo más pequeño porque es el formato que ningún navegador discute,
 * y el que tiene que tragárselo es el Safari de un iPhone cualquiera.
 */
function bytesDeSilencio(): ArrayBuffer {
  const hz = 44100;
  const muestras = 44; // ~1 ms
  const n = muestras * 2;
  // 44 = la cabecera RIFF/WAVE. Las muestras se quedan como nacen, en cero, que en PCM de 16 bits
  // con signo es exactamente el silencio: no hay que escribirlas.
  const buffer = new ArrayBuffer(44 + n);
  const v = new DataView(buffer);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  texto(8, "WAVEfmt ");
  v.setUint32(16, 16, true); // tamaño del bloque de formato
  v.setUint16(20, 1, true); // 1 = PCM sin comprimir
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, hz, true);
  v.setUint32(28, hz * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por muestra
  v.setUint16(34, 16, true); // bits por muestra
  texto(36, "data");
  v.setUint32(40, n, true);
  return buffer;
}

/** La url del silencio, creada una vez por pestaña. No se revoca: dura lo que dura la página. */
let urlDelSilencio: string | null = null;
function silencio(): string {
  if (!urlDelSilencio) {
    urlDelSilencio = URL.createObjectURL(new Blob([bytesDeSilencio()], { type: "audio/wav" }));
  }
  return urlDelSilencio;
}

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
  // Qué narración está REALMENTE cargada en el elemento. Son dos cosas distintas y las dos hacen
  // falta: la clave evita recargar la fuente al reanudar una pausa (recargarla devolvería la
  // aguja al principio, que es justo lo contrario de reanudar), y la url distingue un fallo de
  // la narración de los eventos que suelta el propio elemento al cambiar de fuente o al vaciarse.
  const claveMontadaRef = useRef<string | null>(null);
  const urlMontadaRef = useRef<string | null>(null);

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

  /**
   * El `<audio>` de la sesión. Se crea una sola vez y sus escuchas se enganchan aquí, también
   * una sola vez: con un elemento que se reusa, engancharlas en cada reproducción las iría
   * acumulando.
   */
  const asegurarElemento = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.preload = "auto";

    // El mismo guardia que los demás, y hace falta: el silencio del desbloqueo dura un
    // milisegundo, así que TERMINA en cuanto empieza. Sin esto, su `ended` llegaba justo después
    // de poner «generando la narración…» y lo pisaba con «en pausa», mientras el TTS seguía
    // trabajando, la pantalla decía que ya estaba. Lo que no es la narración no termina nada.
    audio.addEventListener("ended", () => {
      if (urlMontadaRef.current) setStatus("paused");
    });
    audio.addEventListener("error", () => {
      // Solo cuenta como fallo si lo que está cargado es la narración. El silencio del
      // desbloqueo y el vaciado al cambiar de documento pasan por aquí, y no son errores.
      if (urlMontadaRef.current) setStatus("error");
    });

    const sincronizar = () => setCurrentTime(audio.currentTime);
    audio.addEventListener("timeupdate", sincronizar);
    audio.addEventListener("seeked", sincronizar);
    const medir = () => {
      // Un mp3 de TTS puede no traer duración hasta tener metadatos; `Infinity` no sirve para
      // pintar una barra, así que solo se acepta un número finito. Y solo si lo cargado es la
      // narración: el silencio del desbloqueo también tiene duración, de 0,001 s.
      if (urlMontadaRef.current && Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    audio.addEventListener("loadedmetadata", medir);
    audio.addEventListener("durationchange", medir);

    audioRef.current = audio;
    return audio;
  }, []);

  /**
   * Gasta el toque del dedo en algo que el navegador acepte, para que el elemento quede
   * desbloqueado cuando llegue el mp3 veinte segundos después.
   *
   * Tiene que llamarse ANTES del primer `await` de `play`: después, el toque ya no existe.
   */
  const desbloquear = useCallback((audio: HTMLAudioElement) => {
    try {
      urlMontadaRef.current = null;
      claveMontadaRef.current = null;
      audio.src = silencio();
      void audio.play()?.catch(() => {
        // Si ni el silencio arranca, no hay nada que hacer aquí: se intentará igual al final,
        // y si tampoco, el estado `ready` lo dice sin inventarse una causa.
      });
    } catch {
      // Un entorno sin reproducción de audio no debe tumbar la generación.
    }
  }, []);

  /** Carga una narración en el elemento, solo si no es la que ya está puesta. */
  const montar = useCallback((audio: HTMLAudioElement, clave: string, url: string) => {
    if (claveMontadaRef.current === clave && urlMontadaRef.current === url) return;
    claveMontadaRef.current = clave;
    urlMontadaRef.current = url;
    audio.src = url;
  }, []);

  /**
   * Intenta sonar.
   *
   * Hay dos motivos muy distintos por los que un `play()` se rechaza, y meterlos en el mismo saco
   * es el error que hubo que venir a arreglar. `NotAllowedError` es el navegador diciendo «esto no
   * me lo has pedido con el dedo»: la narración está entera y suena con el siguiente toque, así
   * que el estado es `ready`. Cualquier otro nombre (`NotSupportedError` sobre todo, que es lo que
   * sale cuando la fuente no se puede abrir) significa que no hay audio que reproducir, y eso sí
   * es un fallo: decirle «lista, pulsa» a alguien que va a pulsar en vano es peor que no decir
   * nada.
   */
  const sonar = useCallback(async (audio: HTMLAudioElement): Promise<NarrationStatus> => {
    let resultado: NarrationStatus;
    try {
      await audio.play();
      resultado = "playing";
    } catch (error) {
      const bloqueado = error instanceof DOMException && error.name === "NotAllowedError";
      resultado = bloqueado ? "ready" : "error";
    }
    setStatus(resultado);
    return resultado;
  }, []);

  const reset = useCallback(() => {
    const audio = audioRef.current;
    // El elemento SOBREVIVE al reinicio, vacío: con él sobrevive el desbloqueo, y así escuchar
    // la narración del segundo documento no vuelve a depender de la carrera contra el toque.
    urlMontadaRef.current = null;
    claveMontadaRef.current = null;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (cacheRef.current?.esObjeto) URL.revokeObjectURL(cacheRef.current.url);
    cacheRef.current = null;
    setStatus("idle");
    setCurrentTime(0);
    setDuration(0);
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
    urlMontadaRef.current = null;
    claveMontadaRef.current = null;
    audioRef.current?.pause();
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
   *, y sonaría distinta, que es lo que de verdad molesta.
   */
  const audioGenerado = useCallback(() => cacheRef.current?.audio ?? null, []);

  const play = useCallback(async () => {
    if (status === "playing" || !available) return;

    const audio = asegurarElemento();

    // Ya hay audio para este contenido: suena directo, sin pasar por el TTS. Esta rama es también
    // la de reanudar una pausa y la del segundo toque cuando el navegador bloqueó el primero.
    if (cacheRef.current?.key === key) {
      const guardada = !cacheRef.current.esObjeto;
      montar(audio, cacheRef.current.key, cacheRef.current.url);
      if (audio.ended) audio.currentTime = 0;
      const resultado = await sonar(audio);
      // Una narración guardada que no se puede abrir (el archivo ya no está, el servidor devuelve
      // 404) no se arregla pulsando otra vez: esta misma rama volvería a intentarlo contra la
      // misma url para siempre, y «Reintentar» sería un botón que no reintenta nada. Olvidarla
      // deja que el siguiente toque la genere de nuevo. Solo la guardada: si lo que falla es el
      // mp3 que acabamos de generar, tirarlo significaría pagar el TTS otra vez a ciegas.
      if (resultado === "error" && guardada) cacheRef.current = null;
      return;
    }

    // Todavía dentro del toque. A partir del `await` de abajo ya no cuenta.
    desbloquear(audio);

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

      montar(audio, key, url);
      // Desde aquí la narración EXISTE. Lo que pase con la reproducción ya no la deshace: o
      // suena, o queda lista. El `catch` de abajo cubre solo lo de arriba, generarla.
      await sonar(audio);
      // Después de que suene: si guardarla falla, lo que el oyente tiene ya está bien.
      alGenerar?.(blob);
    } catch {
      setStatus("error");
    }
  }, [
    presentation,
    key,
    status,
    available,
    asegurarElemento,
    desbloquear,
    montar,
    sonar,
    alGenerar,
  ]);

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
    // "Pulsa para escuchar" y no "En pausa" con el reloj en 0:00. El audio sigue cacheado, 
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
