"use client";

import { useState } from "react";
import { fetchImageExplanation } from "@/lib/imageExplanation";
import { SkeletonText } from "./Skeleton";

/**
 * "Explicar esta imagen" (Hito 5h Parte 3). Control OPCIONAL junto a una imagen REAL del documento
 * en el `SourcePanel`: pide al modelo una explicación accesible de lo que muestra. Colapsada por
 * defecto (progressive disclosure, Punto 9): no se muestra explicación no solicitada.
 *
 * Es trazabilidad REFORZADA sobre una imagen real, NO una ilustración generada (Parte 1): vive en
 * el panel de fuente, sobre la imagen real, y no lleva etiqueta de "no verificable". Si falla, se
 * dice (honestidad), no queda en silencio.
 */
interface ImageExplanationProps {
  file: File;
  page: number | null;
  context: string | null;
}

export function ImageExplanation({ file, page, context }: ImageExplanationProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  async function handleClick() {
    if (status === "done") {
      setOpen((o) => !o); // ya está: solo mostrar/ocultar
      return;
    }
    setOpen(true);
    setStatus("loading");
    try {
      const explanation = await fetchImageExplanation(file, page, context);
      setText(explanation);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "done" ? (open ? "Ocultar explicación" : "Ver explicación") : "Explicar esta imagen";

  return (
    <div className="border-t border-border p-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="text-xs text-accent underline decoration-1 underline-offset-2 transition-colors hover:text-accent-hover disabled:opacity-50"
      >
        {status === "loading" ? "Explicando la imagen…" : label}
      </button>

      {status === "loading" ? (
        <div className="mt-2 rounded-md bg-surface-sunken px-3 py-3">
          <SkeletonText lines={3} />
        </div>
      ) : null}

      {open && status !== "idle" && status !== "loading" ? (
        <div className="section-enter mt-2 max-h-48 overflow-y-auto rounded-md bg-surface-sunken px-3 py-2">
          {status === "error" ? (
            <p className="text-sm text-warning">No se pudo explicar la imagen.</p>
          ) : (
            <p className="whitespace-pre-wrap text-[0.8125rem] leading-5 text-foreground">{text}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
