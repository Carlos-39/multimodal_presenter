"use client";

import { useEffect, useMemo, useRef } from "react";
import { highlightSegments } from "@/lib/highlight";
import type { GroundingStatus, Section, SourceKind } from "@/lib/types";

/**
 * Panel de documento fuente (atribución interactiva, Punto 4 · Hito 5c).
 *
 * Vive en la zona dinámica (split dentro de `main`), sin tocar el núcleo fijo.
 * Ramifica según el tipo de fuente:
 * - texto: resaltado exacto del rango [char_start, char_end) (o estado neutro si `not_found`).
 * - PDF: documento navegable (iframe nativo), navega a `source.page`. Fidelidad de PÁGINA,
 *   no de región (decisión consciente de alcance). TODO(Hito5e): revisar con layout compositivo.
 * - imagen: imagen completa, sin navegación.
 */
interface OriginalSource {
  text: string | null;
  file: File | null;
}

interface SourcePanelProps {
  original: OriginalSource;
  sourceKind: SourceKind;
  section: Section;
  status: GroundingStatus;
  onClose: () => void;
}

export function SourcePanel({ original, sourceKind, section, status, onClose }: SourcePanelProps) {
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
    <aside className="flex h-full w-[26rem] shrink-0 flex-col border-l border-border bg-surface">
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sourceKind === "text" ? (
          <TextSource text={original.text ?? ""} section={section} status={status} />
        ) : sourceKind === "pdf" ? (
          <PdfSource url={fileUrl} page={section.source.page} />
        ) : (
          <ImageSource url={fileUrl} />
        )}
      </div>
    </aside>
  );
}

function TextSource({
  text,
  section,
  status,
}: {
  text: string;
  section: Section;
  status: GroundingStatus;
}) {
  const markRef = useRef<HTMLElement>(null);
  const segments = highlightSegments(text, section.source.char_start, section.source.char_end);

  useEffect(() => {
    markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [section.id]);

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
  return (
    <>
      {page ? (
        <p className="px-4 pt-3 text-xs text-muted">Referencia: página {page}.</p>
      ) : null}
      <iframe src={src} title="Documento fuente (PDF)" className="h-full w-full border-0" />
    </>
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
