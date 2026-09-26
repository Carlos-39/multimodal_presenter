"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { ContentArea } from "@/components/content/ContentArea";
import { SourcePanel } from "@/components/content/SourcePanel";
import { TransformInput } from "@/components/TransformInput";
import { postTransform } from "@/lib/api";
import { streamTransform } from "@/lib/stream";
import { DEFAULT_DETAIL_LEVEL, visibleSections, type DetailLevel } from "@/lib/detail";
import type {
  ChartNote,
  GroundingReport,
  Section,
  SectionGrounding,
  SemanticCoherenceReport,
  SourceKind,
  TransformResponse,
} from "@/lib/types";

type Status = "idle" | "streaming" | "error" | "done";

interface OriginalSource {
  text: string | null;
  file: File | null;
}

/** Construye un GroundingReport agregado a partir de las entradas por sección (durante streaming). */
function synthGrounding(sourceKind: SourceKind, entries: SectionGrounding[]): GroundingReport {
  return {
    source_kind: sourceKind,
    sections: entries,
    total_sections: entries.length,
    verified_sections: entries.filter((e) => e.status === "verified").length,
    unverified_sections: entries.filter((e) => e.status === "unverified").length,
    not_found_sections: entries.filter((e) => e.status === "not_found").length,
  };
}

export default function Page() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Estado unificado para streaming y no-streaming (fallback).
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [entries, setEntries] = useState<SectionGrounding[]>([]);
  const [aggGrounding, setAggGrounding] = useState<GroundingReport | null>(null);
  const [semantic, setSemantic] = useState<SemanticCoherenceReport | null>(null);
  const [chartNotes, setChartNotes] = useState<ChartNote[]>([]);
  const [sourceKind, setSourceKind] = useState<SourceKind>("text");
  const [original, setOriginal] = useState<OriginalSource | null>(null);

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(DEFAULT_DETAIL_LEVEL);
  const [activeSourceSectionId, setActiveSourceSectionId] = useState<string | null>(null);

  function resetForRun(text: string | null, file: File | null) {
    setError(null);
    setTitle("");
    setSections([]);
    setEntries([]);
    setAggGrounding(null);
    setSemantic(null);
    setChartNotes([]);
    setActiveSectionId(null);
    setActiveSourceSectionId(null);
    setOriginal({ text, file });
    setSourceKind(file ? (file.type === "application/pdf" ? "pdf" : "image") : "text");
  }

  function applyNonStreaming(data: TransformResponse) {
    setTitle(data.presentation.title);
    setSections(data.presentation.sections);
    setEntries(data.grounding.sections);
    setAggGrounding(data.grounding);
    setSemantic(data.semantic);
    setChartNotes(data.chart_notes);
    setSourceKind(data.grounding.source_kind);
    setActiveSectionId(data.presentation.sections[0]?.id ?? null);
  }

  async function handleTransform(text: string | null, file: File | null) {
    resetForRun(text, file);
    setStatus("streaming");
    let received = 0;
    try {
      await streamTransform(text, file, (event) => {
        if (event.type === "start") {
          setTitle(event.title);
        } else if (event.type === "section") {
          received += 1;
          setSections((prev) => [...prev, event.section]);
          setEntries((prev) => [...prev, event.grounding]);
          if (event.chart_note) setChartNotes((prev) => [...prev, event.chart_note!]);
          setActiveSectionId((cur) => cur ?? event.section.id);
        } else if (event.type === "done") {
          setAggGrounding(event.grounding);
          setSemantic(event.semantic);
          setChartNotes(event.chart_notes);
          setStatus("done");
        } else if (event.type === "error") {
          setError(event.message);
          setStatus("error");
        }
      });
      setStatus((prev) => (prev === "streaming" ? "done" : prev));
    } catch {
      if (received === 0) {
        // El streaming no arrancó → fallback gracioso al endpoint no-streaming.
        try {
          const data = await postTransform(text, file);
          applyNonStreaming(data);
          setStatus("done");
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : "Error desconocido");
          setStatus("error");
        }
      } else {
        setError("La generación se interrumpió.");
        setStatus("error");
      }
    }
  }

  const presentation = useMemo(() => ({ title, sections }), [title, sections]);
  const visible = useMemo(() => visibleSections(sections, detailLevel), [sections, detailLevel]);
  const effectiveActiveId = visible.some((s) => s.id === activeSectionId)
    ? activeSectionId
    : (visible[0]?.id ?? null);

  const displayGrounding = aggGrounding ?? (sections.length > 0 ? synthGrounding(sourceKind, entries) : null);
  const observations = semantic?.observations ?? [];

  const activeSourceSection = visible.find((s) => s.id === activeSourceSectionId) ?? null;
  const activeSourceStatus =
    entries.find((g) => g.section_id === activeSourceSectionId)?.status ?? "unverified";

  function handleDetailLevelChange(level: DetailLevel) {
    // TODO(Hito8): punto ÚNICO de interacción — instrumentar tiempo en resumen vs. detallado.
    setDetailLevel(level);
  }

  const hasContent = sections.length > 0;

  return (
    <AppShell
      sections={visible}
      grounding={displayGrounding}
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

            {status === "streaming" ? (
              <p className="text-sm text-muted">
                Generando… {sections.length}{" "}
                {sections.length === 1 ? "sección" : "secciones"}
              </p>
            ) : null}

            {status === "error" ? (
              <div className="rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning">
                {error}
              </div>
            ) : null}
          </div>

          {hasContent ? (
            <ContentArea
              title={presentation.title}
              sections={visible}
              level={detailLevel}
              activeSectionId={effectiveActiveId}
              chartNotes={chartNotes}
              observations={observations}
              onOpenSource={setActiveSourceSectionId}
              activeSourceSectionId={activeSourceSectionId}
            />
          ) : null}
        </div>

        {activeSourceSection && original ? (
          <SourcePanel
            original={original}
            sourceKind={sourceKind}
            section={activeSourceSection}
            status={activeSourceStatus}
            onClose={() => setActiveSourceSectionId(null)}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
