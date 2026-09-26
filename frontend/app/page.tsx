"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ContentArea } from "@/components/content/ContentArea";
import { TransformInput } from "@/components/TransformInput";
import { postTransform } from "@/lib/api";
import { DEFAULT_DETAIL_LEVEL, visibleSections, type DetailLevel } from "@/lib/detail";
import type { TransformResponse } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "done";

/** Documento original enviado — se conserva para la atribución interactiva del Hito 5c. */
interface OriginalSource {
  text: string | null;
  file: File | null;
}

export default function Page() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TransformResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(DEFAULT_DETAIL_LEVEL);
  // TODO(Hito5c): usar `original` para mostrar el documento navegable y resaltar fragmentos.
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

  const visible = useMemo(
    () => (presentation ? visibleSections(presentation.sections, detailLevel) : []),
    [presentation, detailLevel],
  );

  // Activo efectivo: si el activo no está visible (p. ej. un satélite tras volver a resumen),
  // cae al primer visible — sin mutar estado en un efecto.
  const effectiveActiveId = visible.some((s) => s.id === activeSectionId)
    ? activeSectionId
    : (visible[0]?.id ?? null);

  function handleDetailLevelChange(level: DetailLevel) {
    // TODO(Hito8): punto ÚNICO de interacción del control — instrumentar aquí el tiempo en
    // resumen vs. detallado (telemetría comportamental). No enterrar la señal en otra lógica.
    setDetailLevel(level);
  }

  return (
    <AppShell
      sections={visible}
      grounding={grounding}
      activeSectionId={effectiveActiveId}
      onSelectSection={setActiveSectionId}
      detailLevel={detailLevel}
      onDetailLevelChange={handleDetailLevelChange}
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
        <ContentArea
          title={presentation.title}
          sections={visible}
          level={detailLevel}
          activeSectionId={effectiveActiveId}
          chartNotes={result?.chart_notes ?? []}
          observations={result?.semantic.observations ?? []}
        />
      ) : null}
    </AppShell>
  );
}
