"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { Workspace } from "@/components/shell/Workspace";
import { ChatPanel } from "@/components/shell/ChatPanel";
import { ContentArea } from "@/components/content/ContentArea";
import { DeckView } from "@/components/content/DeckView";
import { SlideView } from "@/components/content/SlideView";
import { SourcePanel } from "@/components/content/SourcePanel";
import { StreamingStatus } from "@/components/content/StreamingStatus";
import { SummaryBanner } from "@/components/content/SummaryBanner";
import { TransformInput } from "@/components/TransformInput";
import { sourceKindOf } from "@/lib/audio";
import { postTransform } from "@/lib/api";
import { fetchDeck } from "@/lib/deck";
import { fetchIllustrations } from "@/lib/illustrations";
import { fetchSummary } from "@/lib/summary";
import { streamTransform } from "@/lib/stream";
import { useChat, type OriginalSource } from "@/hooks/useChat";
import { useNarration } from "@/hooks/useNarration";
import { DEFAULT_DETAIL_LEVEL, visibleSections, type DetailLevel } from "@/lib/detail";
import { initTelemetry, track, flush } from "@/lib/telemetry";
import type { PanelId } from "@/lib/workspace";
import type {
  ChartNote,
  GeneratedDeck,
  GroundingReport,
  GroundingStatus,
  Section,
  SectionGrounding,
  SemanticCoherenceReport,
  SourceKind,
  SourceReference,
  SummaryStatus,
  TransformResponse,
} from "@/lib/types";

type Status = "idle" | "streaming" | "error" | "done";

/** Fuente activa en el panel: puede venir de una sección (5c) o de una respuesta del chat (6). */
interface ActiveSource {
  source: SourceReference;
  status: GroundingStatus;
  key: string; // reancla el resaltado al cambiar (id de sección, o único para el chat)
  startS: number | null; // solo audio: momento al que llevar el reproductor
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

  // Adelanto inicial (Hito 5g): preview corto mientras corre la transformación completa.
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>("idle");

  // Ilustraciones de apoyo en camino (post-pase del 5h): solo para avisar en pantalla.
  const [illustrationsPending, setIllustrationsPending] = useState(false);
  const illustrationRunRef = useRef(0); // descarta el resultado de un documento anterior

  // Chat (Hito 6): historial de sesión + streaming + sugerencias, aislado en un hook.
  const chat = useChat(original);

  // Presentación actual (título + secciones completas) y narración (Hito 5g Parte 3). La narración
  // es independiente del toggle resumen/detallado y de la sección activa; solo se reinicia con un
  // documento nuevo (lo hace `resetForRun`, desde el manejador de transformación — no en efecto).
  const presentation = useMemo(() => ({ title, sections }), [title, sections]);
  const narration = useNarration(presentation);

  // Telemetría (Hito 8): relojes de interacción. Los refs se mutan SOLO en manejadores de evento
  // (nunca en render/efecto), coherente con la regla de hooks del proyecto.
  const modeEnteredAtRef = useRef<number | null>(null); // cuándo entró al modo actual (se fija al montar)
  const detailLevelRef = useRef<DetailLevel>(DEFAULT_DETAIL_LEVEL); // espejo para el cierre de sesión
  const sourceOpenedAtRef = useRef<number | null>(null); // cuándo se abrió el panel de fuente

  // Escala 2 (Hito 5e): paneles opcionales abiertos, el más reciente al final (recencia).
  const [openOrder, setOpenOrder] = useState<PanelId[]>([]);

  // Vista de slides (Hito 5h Parte 2): modo alterno de consumir el MISMO contenido ya generado.
  const [slidesOpen, setSlidesOpen] = useState(false);

  // Presentación GENERADA en diapositivas (guion propio desde la fuente): pieza nueva, bajo demanda.
  const [deckOpen, setDeckOpen] = useState(false);
  const [deck, setDeck] = useState<GeneratedDeck | null>(null);
  const [deckStatus, setDeckStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const toggleSlides = useCallback(() => {
    setSlidesOpen((v) => !v);
    setDeckOpen(false); // vistas mutuamente excluyentes
  }, []);

  // "Presentación": genera el deck on-demand. Mejor UX: NO se abre la vista hasta que el deck está
  // COMPLETO (generarlo tarda); mientras tanto el usuario se queda en su contenido y el botón
  // muestra "Generando…". Solo al terminar se cambia a la vista. Falla visible (Reintentar).
  const toggleDeck = useCallback(() => {
    if (deckOpen) {
      setDeckOpen(false);
      return;
    }
    if (deck) {
      // ya generado → abrir de una
      setSlidesOpen(false);
      setDeckOpen(true);
      return;
    }
    if (deckStatus === "loading" || !original) return;
    setDeckStatus("loading");
    fetchDeck(original.text, original.file)
      .then((d) => {
        setDeck(d);
        setDeckStatus("ready");
        setSlidesOpen(false);
        setDeckOpen(true); // recién ahora se muestra, ya completo
      })
      .catch(() => setDeckStatus("error"));
  }, [deckOpen, deck, deckStatus, original]);

  const openPanel = useCallback((id: PanelId) => {
    setOpenOrder((prev) => [...prev.filter((p) => p !== id), id]);
  }, []);
  const closePanel = useCallback((id: PanelId) => {
    setOpenOrder((prev) => prev.filter((p) => p !== id));
    if (id === "source") {
      setActiveSource(null);
      // Tiempo inspeccionando la fuente (señal de "verificación", Punto 4).
      if (sourceOpenedAtRef.current != null) {
        track("source_close", { ms_open: Date.now() - sourceOpenedAtRef.current });
        sourceOpenedAtRef.current = null;
      }
    }
  }, []);
  const toggleChat = useCallback(() => {
    setOpenOrder((prev) =>
      prev.includes("chat") ? prev.filter((p) => p !== "chat") : [...prev, "chat"],
    );
  }, []);
  // Abrir la fuente desde una sección (5c) o desde una respuesta del chat (6): mismo panel.
  // Cada apertura es una señal de "verificación de fuente" (Punto 4). Se registra el estado de
  // grounding para poder ver DESPUÉS si el participante revisa justo las marcadas (not_found).
  const openSectionSource = useCallback(
    (
      section: Section,
      gstatus: GroundingStatus,
      ordinal: number | null,
      startS: number | null,
    ) => {
      setActiveSource({ source: section.source, status: gstatus, key: section.id, startS });
      sourceOpenedAtRef.current = Date.now();
      track("source_open", {
        origin: "section",
        grounding_status: gstatus,
        section_ordinal: ordinal,
      });
      openPanel("source");
    },
    [openPanel],
  );
  const openChatSource = useCallback(
    (source: SourceReference, gstatus: GroundingStatus) => {
      setActiveSource({ source, status: gstatus, key: `chat-${source.quote}`, startS: null });
      sourceOpenedAtRef.current = Date.now();
      track("source_open", { origin: "chat", grounding_status: gstatus });
      openPanel("source");
    },
    [openPanel],
  );

  function resetForRun(text: string | null, file: File | null) {
    chat.reset(); // nuevo documento → nuevo chat (historial de sesión limpio)
    narration.reset(); // nuevo documento → se descarta la narración cacheada
    setError(null);
    setTitle("");
    setSections([]);
    setEntries([]);
    setAggGrounding(null);
    setSemantic(null);
    setChartNotes([]);
    setActiveSectionId(null);
    setActiveSource(null);
    setSummary(null);
    setSummaryStatus("idle");
    illustrationRunRef.current += 1; // invalida ilustraciones en camino del documento anterior
    setIllustrationsPending(false);
    setSlidesOpen(false); // documento nuevo → vuelve a la vista de scroll
    setDeckOpen(false);
    setDeck(null);
    setDeckStatus("idle");
    setOpenOrder((prev) => prev.filter((p) => p !== "source")); // cierra la fuente; conserva el chat
    setOriginal({ text, file });
    setSourceKind(sourceKindOf(file));
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

  // Ilustraciones de apoyo generadas (Hito 5h Parte 1): post-pase NO bloqueante, SOLO para fuentes
  // de texto (condición 1: un texto no trae imágenes). El backend decide qué secciones califican y
  // genera; aquí se fusiona el resultado. Extra no crítico: si falla, no se muestra ilustración.
  async function fetchAndMergeIllustrations(
    pres: { title: string; sections: Section[] },
    isText: boolean,
  ) {
    if (!isText || pres.sections.length === 0) return;
    const run = ++illustrationRunRef.current;
    setIllustrationsPending(true);
    try {
      const items = await fetchIllustrations(pres);
      // Si entretanto se transformó otro documento, este resultado ya no le corresponde.
      if (run !== illustrationRunRef.current || items.length === 0) return;
      setSections((prev) =>
        prev.map((s) => {
          const item = items.find((i) => i.section_id === s.id);
          return item ? { ...s, illustration: item.illustration } : s;
        }),
      );
    } catch {
      // extra no crítico: sin ilustración, la presentación sigue intacta.
    } finally {
      if (run === illustrationRunRef.current) setIllustrationsPending(false);
    }
  }

  async function handleTransform(text: string | null, file: File | null) {
    // Marca el inicio de la interacción con un documento (segmenta la sesión). Solo el TIPO de
    // fuente, nunca el contenido ni el nombre del archivo (privacidad, Hito 8).
    const sk: SourceKind = sourceKindOf(file);
    track("transform_submit", { source_kind: sk });
    resetForRun(text, file);
    setStatus("streaming");

    // Adelanto en PARALELO (Hito 5g): no se espera (no bloquea el streaming). Latencia real del
    // LLM liviano, sin sleep. Si falla, se marca como error y se muestra como tal (honestidad).
    setSummaryStatus("loading");
    fetchSummary(text, file)
      .then((s) => {
        setSummary(s);
        setSummaryStatus("done");
      })
      .catch(() => setSummaryStatus("error"));

    let received = 0;
    let docTitle = "";
    const collected: Section[] = []; // copia local de las secciones (para el post-pase de ilustraciones)
    try {
      await streamTransform(text, file, (event) => {
        if (event.type === "start") {
          docTitle = event.title;
          setTitle(event.title);
        } else if (event.type === "section") {
          received += 1;
          collected.push(event.section);
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
      void fetchAndMergeIllustrations({ title: docTitle, sections: collected }, sk === "text");
    } catch {
      if (received === 0) {
        // El streaming no arrancó → fallback gracioso al endpoint no-streaming.
        try {
          const data = await postTransform(text, file);
          applyNonStreaming(data);
          setStatus("done");
          void fetchAndMergeIllustrations(data.presentation, sk === "text");
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
      const entry = entries.find((g) => g.section_id === section.id);
      const gstatus = entry?.status ?? "unverified";
      const idx = visible.findIndex((s) => s.id === section.id); // ordinal, no el id (privacidad)
      openSectionSource(section, gstatus, idx >= 0 ? idx + 1 : null, entry?.start_s ?? null);
    },
    [entries, visible, openSectionSource],
  );

  const activeSection = useMemo(
    () => visible.find((s) => s.id === effectiveActiveId) ?? null,
    [visible, effectiveActiveId],
  );

  // Estado de anclaje por sección (Hito 8): alimenta el trato honesto del `not_found` en el
  // contenido (aviso en vez de fingir una fuente). Se puebla en streaming y en no-streaming.
  const groundingBySection = useMemo(
    () => Object.fromEntries(entries.map((e) => [e.section_id, e.status])),
    [entries],
  );

  // Prefetch de preguntas sugeridas al profundizar (modo detallado) en la sección activa: se
  // piden en segundo plano y se cachean → cuando el usuario mira el chat, ya están (instantáneas).
  const prefetchSuggestions = chat.prefetchSuggestions;
  useEffect(() => {
    if (detailLevel === "detailed" && activeSection) prefetchSuggestions(activeSection);
  }, [detailLevel, activeSection, prefetchSuggestions]);

  // Telemetría (Hito 8): arranca la sesión al montar y la cierra al ocultarse la pestaña,
  // reportando el último tramo de modo abierto (que ningún cambio llegó a cerrar).
  useEffect(() => {
    initTelemetry();
    modeEnteredAtRef.current = Date.now(); // línea base del primer modo (resumen, al montar)
    const onHide = () => {
      const enteredAt = modeEnteredAtRef.current ?? Date.now();
      track("session_end", {
        final_mode: detailLevelRef.current,
        ms_in_final_mode: Date.now() - enteredAt,
      });
      flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // Ordinal (1-based) de una sección en la lista visible. Se reporta la POSICIÓN, no el id
  // (que lo genera el modelo y podría describir el contenido) — privacidad, Hito 8.
  function ordinalOf(id: string | null): number | null {
    if (!id) return null;
    const i = visible.findIndex((s) => s.id === id);
    return i >= 0 ? i + 1 : null;
  }

  function handleDetailLevelChange(level: DetailLevel) {
    // Punto ÚNICO de interacción (Punto 11): instrumenta el tiempo REAL en cada modo. El cliente
    // lleva el reloj de "cuándo entré a este modo" y reporta cuánto duró el modo que deja.
    if (level === detailLevel) return; // clic redundante: no cuenta como cambio
    const now = Date.now();
    const enteredAt = modeEnteredAtRef.current ?? now;
    track("detail_mode_change", {
      from: detailLevel,
      to: level,
      ms_in_from: now - enteredAt,
      section_ordinal: ordinalOf(effectiveActiveId),
    });
    modeEnteredAtRef.current = now;
    detailLevelRef.current = level;
    setDetailLevel(level);
  }

  const hasContent = sections.length > 0;
  const streaming = status === "streaming";

  // Elegir una sección en el rail siempre lleva a ella. Con la presentación generada abierta (que
  // tiene sus propias diapositivas, no las secciones) se vuelve al contenido en esa sección, en
  // vez de dejar el clic sin efecto.
  function handleSelectSection(id: string) {
    setActiveSectionId(id);
    if (deckOpen) setDeckOpen(false);
  }

  return (
    <AppShell
      sections={visible}
      grounding={displayGrounding}
      activeSectionId={effectiveActiveId}
      onSelectSection={handleSelectSection}
      detailLevel={detailLevel}
      onDetailLevelChange={handleDetailLevelChange}
      chatOpen={openOrder.includes("chat")}
      onToggleChat={toggleChat}
      slidesOpen={slidesOpen}
      slidesAvailable={hasContent}
      onToggleSlides={toggleSlides}
      deckOpen={deckOpen}
      deckReady={deck !== null}
      deckAvailable={hasContent && original !== null}
      deckLoading={deckStatus === "loading"}
      deckError={deckStatus === "error"}
      onToggleDeck={toggleDeck}
      narrationStatus={narration.status}
      narrationAvailable={narration.available}
      onNarrationPlay={narration.play}
      onNarrationPause={narration.pause}
      onNarrationStop={narration.stop}
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
              startS={activeSource!.startS}
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
            activeSectionOrdinal={ordinalOf(effectiveActiveId)}
          />
        }
      >
        {deckOpen && deck ? (
          // Presentación GENERADA (guion propio desde la fuente). Solo se muestra cuando está
          // COMPLETA (la generación ocurre antes, con el botón en "Generando…").
          <DeckView deck={deck} onOpenSource={openChatSource} />
        ) : slidesOpen && hasContent ? (
          // Modo slides (Hito 5h Parte 2): re-vista del MISMO contenido ya generado; el núcleo
          // fijo y las columnas (fuente/chat) siguen disponibles.
          <SlideView
            title={presentation.title}
            sections={visible}
            chartNotes={chartNotes}
            observations={observations}
            onOpenSource={handleOpenSectionSource}
            activeSourceKey={activeSource?.key ?? null}
            groundingBySection={groundingBySection}
            activeSectionId={effectiveActiveId}
            onSelectSection={setActiveSectionId}
            streaming={streaming}
            illustrationsPending={illustrationsPending}
          />
        ) : (
          <>
            <div className="mx-auto max-w-3xl space-y-4 p-6">
              <TransformInput status={status} onSubmit={handleTransform} />

              {streaming ? <StreamingStatus count={sections.length} /> : null}

              {status === "error" ? (
                <div className="rounded-md border border-warning/40 px-4 py-3 text-sm text-warning">
                  {error}
                </div>
              ) : null}
            </div>

            <SummaryBanner status={summaryStatus} summary={summary} />

            {hasContent || streaming ? (
              <ContentArea
                title={presentation.title}
                sections={visible}
                level={detailLevel}
                activeSectionId={effectiveActiveId}
                chartNotes={chartNotes}
                observations={observations}
                onOpenSource={handleOpenSectionSource}
                activeSourceKey={activeSource?.key ?? null}
                groundingBySection={groundingBySection}
                streaming={streaming}
                illustrationsPending={illustrationsPending}
              />
            ) : null}
          </>
        )}
      </Workspace>
    </AppShell>
  );
}
