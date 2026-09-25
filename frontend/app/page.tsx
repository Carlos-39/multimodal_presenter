"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ContentArea } from "@/components/content/ContentArea";
import { TransformInput } from "@/components/TransformInput";
import { postTransform } from "@/lib/api";
import type { TransformResponse } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "done";

/** Documento original enviado — se conserva para la atribución interactiva del Hito 5. */
interface OriginalSource {
  text: string | null;
  file: File | null;
}

export default function Page() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TransformResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  // TODO(Hito5): usar `original` para mostrar el documento navegable y resaltar fragmentos.
  const [, setOriginal] = useState<OriginalSource | null>(null);

  async function handleTransform(text: string | null, file: File | null) {
    setStatus("loading");
    setError(null);
    setOriginal({ text, file }); // conservar el documento original, no descartarlo
    try {
      const data = await postTransform(text, file);
      setResult(data);
      setActiveSectionId(data.presentation.sections[0]?.id ?? null);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setStatus("error");
    }
  }

  const presentation = result?.presentation ?? null;
  const grounding = result?.grounding ?? null;

  return (
    <AppShell
      sections={presentation?.sections ?? []}
      grounding={grounding}
      activeSectionId={activeSectionId}
      onSelectSection={setActiveSectionId}
    >
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <TransformInput status={status} onSubmit={handleTransform} />

        {status === "loading" ? (
          <p className="text-sm text-muted">Generando la presentación…</p>
        ) : null}

        {status === "error" ? (
          <div className="rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
            No se pudo transformar: {error}
          </div>
        ) : null}
      </div>

      {status === "done" && presentation ? (
        <ContentArea presentation={presentation} activeSectionId={activeSectionId} />
      ) : null}
    </AppShell>
  );
}
