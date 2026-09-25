"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "error" | "done";

/**
 * Entrada de texto para disparar la transformación (POST /transform).
 * La subida de archivos multimodal (PDF/imagen) es Hito 4. TODO(Hito4).
 */
interface TransformInputProps {
  status: Status;
  onSubmit: (text: string) => void;
}

export function TransformInput({ status, onSubmit }: TransformInputProps) {
  const [text, setText] = useState("");
  const loading = status === "loading";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length === 0 || loading) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label
        htmlFor="source-text"
        className="block text-sm font-medium text-foreground"
      >
        Texto a transformar
      </label>
      <textarea
        id="source-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Pega aquí el texto que quieres convertir en una presentación estructurada."
        className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        disabled={loading}
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || text.trim().length === 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity disabled:opacity-40"
        >
          {loading ? "Transformando…" : "Transformar"}
        </button>
      </div>
    </form>
  );
}
