"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Workspace } from "@/components/shell/Workspace";
import { ChatPanel } from "@/components/shell/ChatPanel";
import { ContentArea } from "@/components/content/ContentArea";
import { SourcePanel } from "@/components/content/SourcePanel";
import { TransformInput } from "@/components/TransformInput";
import { postTransform } from "@/lib/api";
import { streamTransform } from "@/lib/stream";
import { useChat, type OriginalSource } from "@/hooks/useChat";
import { DEFAULT_DETAIL_LEVEL, visibleSections, type DetailLevel } from "@/lib/detail";
import type { PanelId } from "@/lib/workspace";
import type {
  ChartNote,
  GroundingReport,
  GroundingStatus,
  Section,
  SectionGrounding,
  SemanticCoherenceReport,
  SourceKind,
  SourceReference,
  TransformResponse,
} from "@/lib/types";

type Status = "idle" | "streaming" | "error" | "done";

/** Fuente activa en el panel: puede venir de una sección (5c) o de una respuesta del chat (6). */
interface ActiveSource {
  source: SourceReference;
  status: GroundingStatus;
  key: string; // reancla el resaltado al cambiar (id de sección, o único para el chat)
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
  const [activeSource, setActiveSource] = useState<ActiveSource | null>(null);

  // Chat (Hito 6): historial de sesión + streaming + sugerencias, aislado en un hook.
  const chat = useChat(original);

  // Escala 2 (Hito 5e): paneles opcionales abiertos, el más reciente al final (recencia).
  const [openOrder, setOpenOrder] = useState<PanelId[]>([]);

  const openPanel = useCallback((id: PanelId) => {
    setOpenOrder((prev) => [...prev.filter((p) => p !== id), id]);
  }, []);
  const closePanel = useCallback((id: PanelId) => {
    setOpenOrder((prev) => prev.filter((p) => p !== id));
    if (id === "source") setActiveSource(null);
  }, []);
  const toggleChat = useCallback(() => {
    setOpenOrder((prev) =>
      prev.includes("chat") ? prev.filter((p) => p !== "chat") : [...prev, "chat"],
    );
  }, []);
  // Abrir la fuente desde una sección (5c) o desde una respuesta del chat (6): mismo panel.
  const openSectionSource = useCallback(
    (section: Section, gstatus: GroundingStatus) => {
      setActiveSource({ source: section.source, status: gstatus, key: section.id });
      openPanel("source");
    },
    [openPanel],
  );
  const openChatSource = useCallback(
    (source: SourceReference, gstatus: GroundingStatus) => {
      setActiveSource({ source, status: gstatus, key: `chat-${source.quote}` });
      openPanel("source");
    },
    [openPanel],
  );

  function resetForRun(text: string | null, file: File | null) {
    chat.reset(); // nuevo documento → nuevo chat (historial de sesión limpio)
    setError(null);
    setTitle("");
    setSections([]);
    setEntries([]);
    setAggGrounding(null);
    setSemantic(null);
    setChartNotes([]);
    setActiveSectionId(null);
    setActiveSource(null);
    setOpenOrder((prev) => prev.filter((p) => p !== "source")); // cierra la fuente; conserva el chat
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

  const sourceOpen = activeSource !== null && original !== null;

  // Orden efectivo para el Workspace: la fuente solo cuenta si hay algo que mostrar.
  const effectiveOrder = openOrder.filter((p) => p !== "source" || sourceOpen);

  // Abrir la fuente de una sección: resuelve su estado de grounding y reusa el panel.
  const handleOpenSectionSource = useCallback(
    (section: Section) => {
      const gstatus = entries.find((g) => g.section_id === section.id)?.status ?? "unverified";
      openSectionSource(section, gstatus);
    },
    [entries, openSectionSource],
  );

  const activeSection = useMemo(
    () => visible.find((s) => s.id === effectiveActiveId) ?? null,
    [visible, effectiveActiveId],
  );

  // Prefetch de preguntas sugeridas al profundizar (modo detallado) en la sección activa: se
  // piden en segundo plano y se cachean → cuando el usuario mira el chat, ya están (instantáneas).
  const prefetchSuggestions = chat.prefetchSuggestions;
  useEffect(() => {
    if (detailLevel === "detailed" && activeSection) prefetchSuggestions(activeSection);
  }, [detailLevel, activeSection, prefetchSuggestions]);

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
      chatOpen={openOrder.includes("chat")}
      onToggleChat={toggleChat}
    >
      {/* Escala 2 (Hito 5e): Workspace arbitra contenido + columnas opcionales (fuente, chat).
          El contenido es el slot fijo; las columnas solo cambian al abrir/cerrar un panel. */}
      <Workspace
        openOrder={effectiveOrder}
        onClosePanel={closePanel}
        source={
          sourceOpen ? (
            <SourcePanel
              original={original!}
              sourceKind={sourceKind}
              source={activeSource!.source}
              status={activeSource!.status}
              sourceKey={activeSource!.key}
              onClose={() => closePanel("source")}
            />
          ) : null
        }
        chat={
          <ChatPanel
            messages={chat.messages}
            status={chat.status}
            onSend={chat.send}
            suggestions={effectiveActiveId ? (chat.suggestions[effectiveActiveId] ?? []) : []}
            onOpenSource={openChatSource}
            disabled={original === null}
          />
        }
      >
        <div className="mx-auto max-w-3xl space-y-4 p-6">
          <TransformInput status={status} onSubmit={handleTransform} />

          {status === "streaming" ? (
            <p className="text-sm text-muted">
              Generando… {sections.length} {sections.length === 1 ? "sección" : "secciones"}
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
            onOpenSource={handleOpenSectionSource}
            activeSourceKey={activeSource?.key ?? null}
          />
        ) : null}
      </Workspace>
    </AppShell>
  );
}
