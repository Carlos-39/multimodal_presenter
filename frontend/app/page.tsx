"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ContentArea } from "@/components/content/ContentArea";
import { SourcePanel } from "@/components/content/SourcePanel";
import { TransformInput } from "@/components/TransformInput";
import { postTransform } from "@/lib/api";
import { DEFAULT_DETAIL_LEVEL, visibleSections, type DetailLevel } from "@/lib/detail";
import type { TransformResponse } from "@/lib/types";

type Status = "idle" | "loading" | "error" | "done";

/** Documento original enviado — se conserva para mostrarlo y resaltar fragmentos (Hito 5c). */
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
  const [original, setOriginal] = useState<OriginalSource | null>(null);
  const [activeSourceSectionId, setActiveSourceSectionId] = useState<string | null>(null);

  async function handleTransform(text: string | null, file: File | null) {
    setStatus("loading");
    setError(null);
    setActiveSourceSectionId(null); // cerrar el panel de la fuente anterior
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

  const effectiveActiveId = visible.some((s) => s.id === activeSectionId)
    ? activeSectionId
    : (visible[0]?.id ?? null);

  function handleDetailLevelChange(level: DetailLevel) {
    // TODO(Hito8): punto ÚNICO de interacción del control — instrumentar aquí el tiempo en
    // resumen vs. detallado (telemetría comportamental). No enterrar la señal en otra lógica.
    setDetailLevel(level);
  }

  // Fuente activa: solo sobre una sección visible (si se oculta al cambiar de modo, el panel cierra).
  const activeSourceSection = visible.find((s) => s.id === activeSourceSectionId) ?? null;
  const activeSourceStatus =
    grounding?.sections.find((g) => g.section_id === activeSourceSectionId)?.status ?? "unverified";

  return (
    <AppShell
      sections={visible}
      grounding={grounding}
      activeSectionId={effectiveActiveId}
      onSelectSection={setActiveSectionId}
      detailLevel={detailLevel}
      onDetailLevelChange={handleDetailLevelChange}
    >
      {/* Split simple contenido | fuente. TODO(Hito5e): el layout compositivo debe manejar
          la convivencia de columnas (nav + contenido + fuente + chat) sin apretar el contenido. */}
      <div className="flex h-full">
        <div className="min-w-0 flex-1 overflow-y-auto">
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
              onOpenSource={setActiveSourceSectionId}
              activeSourceSectionId={activeSourceSectionId}
            />
          ) : null}
        </div>

        {activeSourceSection && grounding && original ? (
          <SourcePanel
            original={original}
            sourceKind={grounding.source_kind}
            section={activeSourceSection}
            status={activeSourceStatus}
            onClose={() => setActiveSourceSectionId(null)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
