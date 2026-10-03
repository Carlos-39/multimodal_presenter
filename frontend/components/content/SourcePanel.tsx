"use client";

import { useEffect, useMemo, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { formatTimestamp } from "@/lib/audio";
import { highlightSegments } from "@/lib/highlight";
import type { GroundingStatus, SourceKind, SourceReference } from "@/lib/types";
import { ImageExplanation } from "./ImageExplanation";

/**
 * Panel de documento fuente (atribución interactiva, Punto 4 · Hito 5c). Lo comparten la
 * transformación (fuente de una sección) y el chat (Hito 6): recibe un `SourceReference` + su
 * estado de grounding, no una `Section` — así ambos usan el MISMO panel, no un esquema paralelo.
 *
 * Es una de las COLUMNAS OPCIONALES de la Escala 2 (Hito 5e): `Workspace` decide su ancho y su
 * emplazamiento (columna u overlay), así que llena el espacio que le den (`w-full h-full`).
 * Ramifica según el tipo de fuente:
 * - texto: resaltado exacto del rango [char_start, char_end) (o estado neutro si `not_found`).
 * - PDF: documento navegable (iframe nativo), navega a `source.page`. Fidelidad de PÁGINA,
 *   no de región. TODO(Hito5x): resaltado de región en PDF/imagen.
 * - imagen: imagen completa, sin navegación.
 * - audio: reproductor nativo que arranca en el momento de la cita (`startS`), el análogo de
 *   la fidelidad de página del PDF. Se dice explícitamente que el contenido verbal proviene
 *   de la percepción del modelo y no es verificable contra la señal: el estado es `unverified`
 *   y la UI no finge lo contrario (misma honestidad que el aviso de `not_found` del 8A.1).
 */
interface OriginalSource {
  text: string | null;
  file: File | null;
  audioEvidence: string | null; // opaca aquí: el panel no la usa, viaja con el documento
}

interface SourcePanelProps {
  original: OriginalSource;
  sourceKind: SourceKind;
  source: SourceReference;
  status: GroundingStatus;
  sourceKey: string; // reancla el resaltado al cambiar de fuente (sección o chat)
  startS?: number | null; // solo audio: segundo en el que arranca la cita
  transcript?: string | null; // solo audio: lo que oyó la fase de percepción
  onClose: () => void;
}

export function SourcePanel({
  original,
  sourceKind,
  source,
  status,
  sourceKey,
  startS = null,
  transcript = null,
  onClose,
}: SourcePanelProps) {
  // El object URL se crea y se revoca en el MISMO efecto, para que cada montaje tenga el suyo.
  //
  // Antes se creaba en un `useMemo` y se revocaba en el cleanup de un efecto aparte, y eso se
  // rompe con el doble montaje de StrictMode: monta → el cleanup revoca la URL → vuelve a
  // montar, pero el `useMemo` está cacheado y devuelve la MISMA URL, ya muerta. Se descubrió al
  // añadir el audio: el `<iframe>` del PDF y el `<img>` alcanzaban a cargar antes del revoke,
  // pero el `<audio>` carga sus metadatos más tarde y se encontraba la URL revocada
  // (`MEDIA_ELEMENT_ERROR: Format error`). Solo se manifestaba en desarrollo; aun así, depender
  // de ese orden de carga era frágil para los tres tipos de fuente.
  const fileUrl = useMemo(
    () => (original.file ? URL.createObjectURL(original.file) : null),
    [original.file],
  );
  // Se revoca la URL ANTERIOR cuando cambia el documento, NO al cerrar el panel: cerrar y
  // reabrir la fuente del mismo archivo debe seguir funcionando. La última queda viva hasta
  // que se descarga la página, que es cuando el navegador la libera igual.
  const urlPrevia = useRef<string | null>(null);
  useEffect(() => {
    const anterior = urlPrevia.current;
    urlPrevia.current = fileUrl;
    if (anterior && anterior !== fileUrl) URL.revokeObjectURL(anterior);
  }, [fileUrl]);

  return (
    <aside className="section-enter flex h-full w-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-border py-2 pl-4 pr-2">
        <h2 className="text-[0.8125rem] font-medium text-foreground">Documento fuente</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el documento fuente"
          title="Cerrar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
        >
          <X size={15} aria-hidden />
        </button>
      </header>

      {/* `key={sourceKey}` REMONTA el contenido al cambiar de fuente activa (otra sección o una
          respuesta del chat). Es necesario para el PDF: su página se fija por el fragmento
          `#page=N` del `src` del <iframe>, y los navegadores NO re-navegan un iframe cuando solo
          cambia el hash — remontarlo lo fuerza a cargar en la página correcta. Robusto ante clics
          rápidos (React reconcilia al último key) y uniforme para texto, PDF, imagen y audio. */}
      <div key={sourceKey} className="min-h-0 flex-1 overflow-y-auto">
        {sourceKind === "text" ? (
          <TextSource
            text={original.text ?? ""}
            source={source}
            status={status}
            sourceKey={sourceKey}
          />
        ) : sourceKind === "pdf" ? (
          <PdfSource url={fileUrl} page={source.page} fileName={original.file?.name ?? null} />
        ) : sourceKind === "audio" ? (
          <AudioSource
            url={fileUrl}
            quote={source.quote}
            startS={startS}
            transcript={transcript}
            sourceKey={sourceKey}
          />
        ) : (
          <ImageSource url={fileUrl} />
        )}
      </div>

      {/* Explicar imagen REAL (Hito 5h Parte 3): solo para fuentes binarias (PDF/imagen). Vive
          aquí, sobre la imagen real = trazabilidad reforzada; NO es una ilustración generada. Se
          remonta por `sourceKey` → colapsada de nuevo al cambiar de fuente. */}
      {sourceKind !== "text" && sourceKind !== "audio" && original.file ? (
        <ImageExplanation
          key={sourceKey}
          file={original.file}
          page={source.page ?? null}
          context={source.quote}
        />
      ) : null}
    </aside>
  );
}

function TextSource({
  text,
  source,
  status,
  sourceKey,
}: {
  text: string;
  source: SourceReference;
  status: GroundingStatus;
  sourceKey: string;
}) {
  const markRef = useRef<HTMLElement>(null);
  const segments = highlightSegments(text, source.char_start, source.char_end);

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sourceKey]);

  return (
    <div className="px-5 py-4">
      {status === "not_found" ? (
        <p className="mb-3 rounded-md border border-warning/40 px-3 py-2 text-xs text-warning">
          No se pudo verificar este fragmento en el documento.
        </p>
      ) : null}
      <p className="whitespace-pre-wrap font-serif text-[0.9375rem] leading-[1.65] text-foreground-secondary">
        {segments.before}
        {segments.mark ? (
          <mark ref={markRef} className="rounded-[2px] bg-highlight px-0.5 text-foreground">
            {segments.mark}
          </mark>
        ) : null}
        {segments.after}
      </p>
    </div>
  );
}

function PdfSource({
  url,
  page,
  fileName,
}: {
  url: string | null;
  page: number | null;
  fileName: string | null;
}) {
  if (!url) return <PanelMessage>No hay documento disponible.</PanelMessage>;
  const src = page ? `${url}#page=${page}` : url;
  // El <iframe>#page=N depende del visor nativo del navegador y NO funciona en la mayoría de
  // móviles ni en navegadores sin visor embebido. De ahí las dos salidas del encabezado:
  //
  // - "Abrir en pestaña nueva": lo natural en escritorio.
  // - "Descargar": la salida fiable donde la anterior no lo es. Abrir una URL `blob:` en una
  //   pestaña nueva depende del navegador —algunos lo bloquean y en móvil es justo donde menos
  //   se puede confiar—, que es precisamente el escenario para el que se creó este enlace en el
  //   5f. El atributo `download` no depende de que exista un visor.
  //
  // Se AÑADE la descarga en vez de reemplazar el enlace: lo que ya funciona en escritorio sigue
  // igual, y quien no pueda abrirlo tiene una salida que no falla.
  const nombreDescarga = fileName || "documento.pdf";
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs">
        <span className="min-w-0 truncate text-muted">
          {page ? (
            <>
              Referencia: página <span className="tabular">{page}</span>
            </>
          ) : (
            "Documento PDF"
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-1 underline-offset-2 hover:text-accent-hover"
          >
            Abrir en pestaña nueva
          </a>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <a
            href={url}
            download={nombreDescarga}
            className="text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
          >
            Descargar
          </a>
        </span>
      </div>
      <iframe src={src} title="Documento fuente (PDF)" className="min-h-0 flex-1 border-0" />
    </div>
  );
}

/**
 * Fuente de audio. El equivalente honesto de la "fidelidad de página" del PDF: lleva al
 * MOMENTO de la cita, que es el grano real que el sistema puede ofrecer sobre una señal.
 *
 * Dice explícitamente de dónde viene el texto de la cita (de la percepción del modelo, no de
 * la señal verificada) en vez de presentarla como un fragmento verificado. Es la misma
 * honestidad del aviso de `not_found` del 8A.1: lo que ancla es trazable, lo que no, se avisa.
 */
function AudioSource({
  url,
  quote,
  startS,
  transcript,
  sourceKey,
}: {
  url: string | null;
  quote: string;
  startS: number | null;
  transcript: string | null;
  sourceKey: string;
}) {
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const markRef = useRef<HTMLElement>(null);

  // La cita se LOCALIZA dentro de la transcripción (mismo helper que el caso de texto), pero
  // eso NO la verifica: la transcripción es lo que el modelo oyó, no la señal. Por eso el
  // grounding sigue en `unverified` y el pie lo dice. Si no se encuentra, no se resalta nada
  // en vez de resaltar algo aproximado.
  const idx = transcript ? transcript.indexOf(quote) : -1;
  const segmentos =
    transcript && idx !== -1 ? highlightSegments(transcript, idx, idx + quote.length) : null;

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sourceKey]);

  // Arranca en el momento de la cita. Hay que esperar a que los metadatos carguen: antes de eso
  // `currentTime` no se puede fijar (la duración aún no se conoce).
  useEffect(() => {
    const player = playerRef.current;
    if (!player || startS === null) return;
    const seek = () => {
      player.currentTime = startS;
    };
    if (player.readyState >= 1) seek();
    else player.addEventListener("loadedmetadata", seek, { once: true });
    return () => player.removeEventListener("loadedmetadata", seek);
  }, [startS, url]);

  if (!url) return <PanelMessage>No hay audio disponible.</PanelMessage>;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">Audio fuente</span>
        {startS !== null ? (
          <span className="text-muted">
            Referencia: <span className="tabular">{formatTimestamp(startS)}</span>
          </span>
        ) : null}
      </div>

      <audio ref={playerRef} src={url} controls className="w-full" />

      {segmentos ? (
        // Transcripción completa con la cita resaltada: el equivalente honesto de lo que el
        // panel hace con un documento de texto, para poder leer el contexto de la cita.
        <div>
          <p className="mb-2 text-xs text-muted">Transcripción</p>
          <p className="whitespace-pre-wrap font-serif text-[0.9375rem] leading-[1.65] text-foreground-secondary">
            {segmentos.before}
            {segmentos.mark ? (
              <mark ref={markRef} className="rounded-[2px] bg-highlight px-0.5 text-foreground">
                {segmentos.mark}
              </mark>
            ) : null}
            {segmentos.after}
          </p>
        </div>
      ) : (
        // Sin transcripción (o con una cita que no aparece en ella): se muestra la cita sola,
        // sin fingir un contexto que no se tiene.
        <figure className="border-l-2 border-border pl-3">
          <blockquote className="text-sm leading-relaxed text-foreground">“{quote}”</blockquote>
        </figure>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Esto es lo que el modelo <strong className="font-medium">oyó</strong> en el audio, no una
        transcripción verificada. Puede tener errores: escucha el fragmento para confirmarlo.
      </p>
    </div>
  );
}

function ImageSource({ url }: { url: string | null }) {
  if (!url) return <PanelMessage>No hay documento disponible.</PanelMessage>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Documento fuente" className="w-full p-4" />;
}

function PanelMessage({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-sm text-muted">{children}</p>;
}
