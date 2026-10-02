"use client";

import { useRef, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";

type Status = "idle" | "loading" | "streaming" | "error" | "done";

// Audio incluido: lo procesa la fase de percepción del backend (entrada acústica nativa).
// M4A va con sus tres nombres (los navegadores no se ponen de acuerdo) más la extensión, porque
// es el formato por defecto de las grabadoras de celular y de muchos podcasts descargables.
// `video/mp4` NO se incluye: el sistema no procesa video, y el backend lo rechazaría.
const ACCEPT =
  "application/pdf,image/png,image/jpeg,image/webp," +
  "audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/aac,audio/aiff," +
  "audio/mp4,audio/m4a,audio/x-m4a,.m4a";

/**
 * Entrada de la transformación: texto y/o archivo (PDF/imagen). Debe haber al menos uno.
 * El control de subida vive en la zona de contenido junto al texto (respeta Stable Core:
 * no toca el armazón fijo).
 */
interface TransformInputProps {
  status: Status;
  onSubmit: (text: string | null, file: File | null) => void;
}

export function TransformInput({ status, onSubmit }: TransformInputProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = status === "loading" || status === "streaming";
  const canSubmit = !loading && (text.trim().length > 0 || file !== null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(text.trim() || null, file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="source-text" className="block text-sm font-medium text-foreground">
          Texto <span className="font-normal text-muted">(opcional si subes un archivo)</span>
        </label>
        <textarea
          id="source-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Pega un texto, o escribe una instrucción para acompañar al documento."
          className="w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted disabled:opacity-60"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">Documento (PDF, imagen o audio)</span>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-md border p-4 text-sm transition-colors ${
            dragging ? "border-accent bg-accent-subtle" : "border-transparent bg-surface-sunken"
          }`}
        >
          {file ? (
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-foreground">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="shrink-0 text-xs text-accent underline decoration-1 underline-offset-2 hover:text-accent-hover"
              >
                quitar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full text-left text-muted hover:text-foreground"
            >
              Arrastra un PDF, una imagen o un audio aquí, o haz clic para seleccionar.
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:opacity-45 disabled:hover:bg-accent"
        >
          {loading ? <CircleNotch size={15} className="animate-spin" aria-hidden /> : null}
          {loading ? "Transformando…" : "Transformar"}
        </button>
      </div>
    </form>
  );
}
