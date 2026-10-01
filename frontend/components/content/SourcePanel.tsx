"use client";

import { useEffect, useMemo, useRef } from "react";
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
 */
interface OriginalSource {
  text: string | null;
  file: File | null;
}

interface SourcePanelProps {
  original: OriginalSource;
  sourceKind: SourceKind;
  source: SourceReference;
  status: GroundingStatus;
  sourceKey: string; // reancla el resaltado al cambiar de fuente (sección o chat)
  onClose: () => void;
}

export function SourcePanel({
  original,
  sourceKind,
  source,
  status,
  sourceKey,
  onClose,
}: SourcePanelProps) {
  const fileUrl = useMemo(
    () => (original.file ? URL.createObjectURL(original.file) : null),
    [original.file],
  );
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  return (
    <aside className="section-enter flex h-full w-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Documento fuente
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
        >
          cerrar
        </button>
      </header>

      {/* `key={sourceKey}` REMONTA el contenido al cambiar de fuente activa (otra sección o una
          respuesta del chat). Es necesario para el PDF: su página se fija por el fragmento
          `#page=N` del `src` del <iframe>, y los navegadores NO re-navegan un iframe cuando solo
          cambia el hash — remontarlo lo fuerza a cargar en la página correcta. Robusto ante clics
          rápidos (React reconcilia al último key) y uniforme para texto/PDF/imagen. */}
      <div key={sourceKey} className="min-h-0 flex-1 overflow-y-auto">
        {sourceKind === "text" ? (
          <TextSource
            text={original.text ?? ""}
            source={source}
            status={status}
            sourceKey={sourceKey}
          />
        ) : sourceKind === "pdf" ? (
          <PdfSource url={fileUrl} page={source.page} />
        ) : (
          <ImageSource url={fileUrl} />
        )}
      </div>

      {/* Explicar imagen REAL (Hito 5h Parte 3): solo para fuentes binarias (PDF/imagen). Vive
          aquí, sobre la imagen real = trazabilidad reforzada; NO es una ilustración generada. Se
          remonta por `sourceKey` → colapsada de nuevo al cambiar de fuente. */}
      {sourceKind !== "text" && original.file ? (
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
    <div className="p-4">
      {status === "not_found" ? (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
          No se pudo verificar este fragmento en el documento.
        </p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {segments.before}
        {segments.mark ? (
          <mark ref={markRef} className="rounded bg-accent px-0.5 text-accent-foreground">
            {segments.mark}
          </mark>
        ) : null}
        {segments.after}
      </p>
    </div>
  );
}

function PdfSource({ url, page }: { url: string | null; page: number | null }) {
  if (!url) return <PanelMessage>No hay documento disponible.</PanelMessage>;
  const src = page ? `${url}#page=${page}` : url;
  // El <iframe>#page=N depende del visor nativo del navegador y NO funciona en la mayoría de
  // móviles ni en navegadores sin visor embebido. El enlace es la salida siempre utilizable.
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs">
        <span className="text-muted">{page ? `Referencia: página ${page}.` : "Documento PDF"}</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted underline underline-offset-2 hover:text-foreground"
        >
          Abrir PDF en pestaña nueva
        </a>
      </div>
      <iframe src={src} title="Documento fuente (PDF)" className="min-h-0 flex-1 border-0" />
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
