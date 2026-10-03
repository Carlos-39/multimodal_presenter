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
import { olvidarPaginas } from "@/lib/pdfPage";
import { fetchIllustrations } from "@/lib/illustrations";
import { fetchSummary } from "@/lib/summary";
import { streamTransform } from "@/lib/stream";
import { useChat } from "@/hooks/useChat";
import { useNarration } from "@/hooks/useNarration";
import { DEFAULT_DETAIL_LEVEL, visibleSections, type DetailLevel } from "@/lib/detail";
import { initTelemetry, track, flush } from "@/lib/telemetry";
import {
  abrirPresentacion,
  actualizarPresentacion,
  deckGuardado as deckDeLaBiblioteca,
  guardarChat,
  guardarDeck,
  guardarNarracion,
  guardarPresentacion,
  quienSoy,
  textoDelDocumento,
  urlDeLaNarracion,
  type MensajeGuardado,
  type Usuario,
} from "@/lib/account";
import { AccountButton } from "@/components/shell/AccountButton";
import { AccountPanel } from "@/components/shell/AccountPanel";
import type { PanelId } from "@/lib/workspace";
import type {
  ChartNote,
  CitedRegion,
  GeneratedDeck,
  GroundingReport,
  GroundingStatus,
  OriginalSource,
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
  region: CitedRegion | null; // solo PDF: dónde está la cita dentro de la página
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

/** Tramo del reloj de modo. `deck` es un tramo PROPIO, no un nivel de detalle: ver `modeBucketRef`. */
type ModeBucket = DetailLevel | "deck";

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
  // Solo audio: lo que oyó la fase de percepción (ver StreamEvent "transcript").
  const [transcript, setTranscript] = useState<string | null>(null);

  // Cuenta: OPCIONAL. Sin ella todo sigue funcionando igual — las sesiones de evaluación del
  // Hito 8 corren sin login. Entrar añade guardar y volver, nada más.
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [guardando, setGuardando] = useState<"idle" | "guardando" | "guardada" | "error">("idle");

  // Qué presentación guardada se está viendo, o `null` si lo de pantalla no está guardado. Es lo
  // único que hace falta para que el chat se persista: sin presentación no hay dónde, y entonces
  // el chat se comporta igual que antes (que es como corren las sesiones del Hito 8).
  //
  // En un ref y no en estado porque lo lee el aviso de "turno terminado" del chat. En estado,
  // cada vez que cambiara habría que reconstruir ese callback y con él `send`, que el panel de
  // chat recibe como prop; el ref lo deja estable.
  const presentacionIdRef = useRef<string | null>(null);

  // Ilustraciones de apoyo en camino (post-pase del 5h): solo para avisar en pantalla.
  const [illustrationsPending, setIllustrationsPending] = useState(false);
  const illustrationRunRef = useRef(0); // descarta el resultado de un documento anterior

  // Chat (Hito 6): historial + streaming + sugerencias, aislado en un hook.
  //
  // El hook no sabe que existen cuentas: avisa de cada turno terminado y aquí se decide si hay
  // dónde guardarlo. Así el chat sin cuenta queda exactamente como estaba, sin una rama que
  // mantener en dos sitios.
  const alTerminarTurno = useCallback((mensajes: MensajeGuardado[]) => {
    const id = presentacionIdRef.current;
    if (id) void guardarChat(id, mensajes);
  }, []);
  const chat = useChat(original, { alTerminarTurno });

  // Presentación actual (título + secciones completas) y narración (Hito 5g Parte 3). La narración
  // es independiente del toggle resumen/detallado y de la sección activa; solo se reinicia con un
  // documento nuevo (lo hace `resetForRun`, desde el manejador de transformación — no en efecto).
  const presentation = useMemo(() => ({ title, sections }), [title, sections]);
  // Mismo reparto que el chat: el hook avisa del mp3 que acaba de generar y aquí se decide si hay
  // dónde guardarlo. Sin cuenta nadie escucha y la narración funciona igual que antes.
  const alGenerarNarracion = useCallback((audio: Blob) => {
    const id = presentacionIdRef.current;
    if (id) void guardarNarracion(id, audio);
  }, []);
  const narration = useNarration(presentation, { alGenerar: alGenerarNarracion });

  // Telemetría (Hito 8): relojes de interacción. Los refs se mutan SOLO en manejadores de evento
  // (nunca en render/efecto), coherente con la regla de hooks del proyecto.
  const modeEnteredAtRef = useRef<number | null>(null); // cuándo entró al tramo actual (se fija al montar)
  const detailLevelRef = useRef<DetailLevel>(DEFAULT_DETAIL_LEVEL); // espejo para el cierre de sesión
  // El reloj reparte TODO el tiempo de la sesión en tramos, sin huecos ni solapes. La presentación
  // generada es un tramo PROPIO: en esa vista el nivel de detalle no filtra nada (tiene sus propias
  // diapositivas), así que sumar ese tiempo a "resumen" o "detallado" sería atribuirlo a un modo
  // que no estaba actuando — y el reparto resumen/detallado es una medida central de la RQ3.
  const modeBucketRef = useRef<ModeBucket>(DEFAULT_DETAIL_LEVEL);
  const sourceOpenedAtRef = useRef<number | null>(null); // cuándo se abrió el panel de fuente

  // Escala 2 (Hito 5e): paneles opcionales abiertos, el más reciente al final (recencia).
  const [openOrder, setOpenOrder] = useState<PanelId[]>([]);

  // Vista de slides (Hito 5h Parte 2): modo alterno de consumir el MISMO contenido ya generado.
  const [slidesOpen, setSlidesOpen] = useState(false);

  // Presentación GENERADA en diapositivas (guion propio desde la fuente): pieza nueva, bajo demanda.
  const [deckOpen, setDeckOpen] = useState(false);
  // PUNTO ÚNICO para mostrar/ocultar la presentación generada: cierra el tramo de reloj anterior y
  // abre el nuevo. Se encauza aquí porque esta vista se abre y se cierra desde SEIS sitios (el
  // botón, el final de la generación asíncrona, elegir sección en el rail, cambiar de vista,
  // documento nuevo) y bastaba olvidar uno para que el tiempo quedara atribuido al tramo erróneo.
  // Cierra el tramo de modo en curso y abre el siguiente, reportando cuánto duró el que se deja.
  // El evento y su payload no cambian: solo se amplía el vocabulario de `from`/`to` con `deck`, así
  // el reparto sigue cubriendo la sesión completa sin huecos. Estable (solo refs) a propósito.
  const cerrarTramo = useCallback((siguiente: ModeBucket, ordinal: number | null) => {
    const ahora = Date.now();
    const desde = modeEnteredAtRef.current ?? ahora;
    track("detail_mode_change", {
      from: modeBucketRef.current,
      to: siguiente,
      ms_in_from: ahora - desde,
      section_ordinal: ordinal,
    });
    modeEnteredAtRef.current = ahora;
    modeBucketRef.current = siguiente;
  }, []);

  const deckVisibleRef = useRef(false); // espejo de `deckOpen` para decidir sin leer estado
  const setDeckVisible = useCallback((abierto: boolean) => {
    if (deckVisibleRef.current === abierto) return; // sin cambio de vista no se mueve el reloj
    deckVisibleRef.current = abierto;
    // Al salir se vuelve al nivel de detalle vigente, que pudo cambiar mientras el deck estaba
    // abierto (el control sigue visible ahí aunque no afecte a esa vista).
    cerrarTramo(abierto ? "deck" : detailLevelRef.current, null);
    setDeckOpen(abierto);
  }, [cerrarTramo]);
  const [deck, setDeck] = useState<GeneratedDeck | null>(null);
  const [deckStatus, setDeckStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  // Hay un deck guardado que todavía no se ha traído. No se descarga al restaurar porque con
  // ilustraciones pesa megas y puede que nadie lo abra; saber que existe basta para que el botón
  // diga «Abrir presentación» en vez de ofrecer generarla otra vez.
  const [deckGuardado, setDeckGuardado] = useState(false);

  // PUNTO ÚNICO para la vista de slides, por lo mismo que el deck: también se cierra desde otros
  // sitios (al abrir la presentación generada, o con un documento nuevo), y un espejo que no pasara
  // por aquí se desincronizaría del estado — el toggle acabaría invirtiendo el valor equivocado.
  const slidesVisibleRef = useRef(false);
  const setSlidesVisible = useCallback((abierto: boolean) => {
    if (slidesVisibleRef.current === abierto) return;
    slidesVisibleRef.current = abierto;
    // Marca de USO, sin reloj propio: en la vista de slides el nivel de detalle SÍ actúa (decide
    // qué secciones son diapositivas), así que ese tiempo pertenece a su tramo de resumen/detallado.
    // Lo que no se sabía era si alguien la abría; eso es lo que registra esto.
    track("view_change", { to: abierto ? "slides" : "document" });
    setSlidesOpen(abierto);
  }, []);
  const toggleSlides = useCallback(() => {
    setSlidesVisible(!slidesVisibleRef.current);
    setDeckVisible(false); // vistas mutuamente excluyentes
  }, [setSlidesVisible, setDeckVisible]);

  // "Presentación": genera el deck on-demand. Mejor UX: NO se abre la vista hasta que el deck está
  // COMPLETO (generarlo tarda); mientras tanto el usuario se queda en su contenido y el botón
  // muestra "Generando…". Solo al terminar se cambia a la vista. Falla visible (Reintentar).
  const toggleDeck = useCallback(() => {
    if (deckOpen) {
      setDeckVisible(false);
      return;
    }
    if (deck) {
      // ya generado → abrir de una
      setSlidesVisible(false);
      setDeckVisible(true);
      return;
    }
    if (deckStatus === "loading" || !original) return;
    setDeckStatus("loading");

    // Si ya hay uno guardado se TRAE, no se genera. Generarlo otra vez daría otras diapositivas:
    // quien guardó esta presentación guardó estas, no unas parecidas.
    const id = presentacionIdRef.current;
    const pedir = deckGuardado && id ? deckDeLaBiblioteca(id) : fetchDeck(original);

    pedir
      .then((d) => {
        setDeck(d);
        setDeckStatus("ready");
        setSlidesVisible(false);
        setDeckVisible(true); // recién ahora se muestra, ya completo
        // Recién generado y con dónde guardarlo: se guarda para que la próxima vez sea el mismo.
        if (!deckGuardado && id) {
          void guardarDeck(id, d);
          setDeckGuardado(true);
        }
      })
      .catch(() => setDeckStatus("error"));
  }, [deckOpen, deck, deckStatus, deckGuardado, original, setDeckVisible, setSlidesVisible]);

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
      region: CitedRegion | null,
    ) => {
      setActiveSource({
        source: section.source,
        status: gstatus,
        key: section.id,
        startS,
        region,
      });
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
  // Abrir una cita suelta (chat o diapositiva generada): mismo panel, distinto ORIGEN. El origen
  // se separa porque es una medida de la RQ3 (¿desde dónde verifica la gente?) y la presentación
  // generada reusaba este manejador, así que sus clics se contaban como si vinieran del chat.
  const openLooseSource = useCallback(
    (
      origin: "chat" | "deck",
      source: SourceReference,
      gstatus: GroundingStatus,
      startS: number | null,
      region: CitedRegion | null,
    ) => {
      setActiveSource({
        source,
        status: gstatus,
        key: `${origin}-${source.quote}`,
        startS,
        region,
      });
      sourceOpenedAtRef.current = Date.now();
      track("source_open", { origin, grounding_status: gstatus });
      openPanel("source");
    },
    [openPanel],
  );
  const openChatSource = useCallback(
    (
      source: SourceReference,
      gstatus: GroundingStatus,
      startS: number | null = null,
      region: CitedRegion | null = null,
    ) => openLooseSource("chat", source, gstatus, startS, region),
    [openLooseSource],
  );
  const openDeckSource = useCallback(
    (
      source: SourceReference,
      gstatus: GroundingStatus,
      startS: number | null = null,
      region: CitedRegion | null = null,
    ) => openLooseSource("deck", source, gstatus, startS, region),
    [openLooseSource],
  );

  function resetForRun(text: string | null, file: File | null) {
    olvidarPaginas(original?.file ?? null); // suelta las páginas dibujadas del documento anterior
    chat.reset(); // nuevo documento → nuevo chat (y nada que persistir hasta que se guarde)
    // Documento nuevo: lo de pantalla ya no es la presentación guardada. Sin esto, la
    // conversación del documento nuevo se escribiría encima de la del anterior.
    presentacionIdRef.current = null;
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
    setTranscript(null);
    illustrationRunRef.current += 1; // invalida ilustraciones en camino del documento anterior
    setIllustrationsPending(false);
    setSlidesVisible(false); // documento nuevo → vuelve a la vista de scroll
    setDeckVisible(false);
    setDeck(null);
    setDeckStatus("idle");
    setDeckGuardado(false);
    setOpenOrder((prev) => prev.filter((p) => p !== "source")); // cierra la fuente; conserva el chat
    setOriginal({ text, file, audioEvidence: null, documentId: null }); // la evidencia llega con el stream
    setSourceKind(sourceKindOf(file));
  }

  /**
   * Guarda lo que hay en pantalla, con el documento del que salió y la conversación que ya hubo.
   *
   * Si esto YA es una presentación guardada, la completa en vez de crear otra. Antes creaba una
   * gemela con el mismo nombre, y deshabilitar el botón no habría bastado: lo que se ve puede
   * crecer DESPUÉS de guardarlo, porque las ilustraciones de apoyo llegan en un post-pase. Quien
   * guarda en cuanto salen las secciones y vuelve a pulsar diez segundos más tarde quiere
   * completar lo suyo. Y la misma gemela salía por otra puerta: al restaurar una guardada, el
   * botón volvía a ofrecer «Guardar».
   */
  async function guardar() {
    if (!original || sections.length === 0) return;
    setGuardando("guardando");
    const titulo = title || "Sin título";
    const payload = {
      presentation: { title, sections },
      grounding: displayGrounding ?? synthGrounding(sourceKind, entries),
      chart_notes: chartNotes,
      transcript,
      audio_evidence: original.audioEvidence,
    };
    try {
      const yaGuardada = presentacionIdRef.current;
      if (yaGuardada) {
        await actualizarPresentacion(yaGuardada, titulo, payload);
        setGuardando("guardada");
        return;
      }

      const guardada = await guardarPresentacion(titulo, payload, {
        text: original.text,
        file: original.file,
      });
      // Desde aquí cada turno nuevo se va guardando solo. Y lo que YA se había preguntado antes
      // de pulsar «Guardar» también cuenta: si no, guardar justo después de una conversación
      // larga la perdería entera, que es el momento en que más duele.
      presentacionIdRef.current = guardada.id;
      alTerminarTurno(chat.historialGuardable());
      // Y lo que ya se había generado: quien pulsa «Guardar» después de hacerse la presentación
      // en diapositivas espera guardarla, no guardar la orden de volver a generarla.
      if (deck) {
        void guardarDeck(guardada.id, deck);
        setDeckGuardado(true);
      }
      const audio = narration.audioGenerado();
      if (audio) void guardarNarracion(guardada.id, audio);
      setGuardando("guardada");
    } catch {
      setGuardando("error");
    }
  }

  /** Restaura una presentación guardada: el mismo estado que dejaría una generación.
   *
   * Pasa por `resetForRun` igual que una transformación nueva, en vez de asignar campo por campo.
   * Si se restaurara por un camino propio, cada estado que alguien añada después habría que
   * acordarse de limpiarlo también aquí — y lo que se olvide quedaría del documento anterior.
   */
  async function restaurar(id: string) {
    const g = await abrirPresentacion(id);
    // Las fuentes de TEXTO se traen enteras: el panel de fuente las resalta carácter a carácter,
    // así que no le sirve una URL. Las binarias sí se resuelven por URL cuando hagan falta.
    const texto = g.source_kind === "text" ? await textoDelDocumento(g.document_id) : null;
    resetForRun(null, null);
    setOriginal({
      text: texto,
      file: null,
      audioEvidence: g.payload.audio_evidence ?? null,
      // El documento vive en el almacén: esto es lo que deja seguir usándola sin tener el archivo.
      documentId: g.document_id,
    });
    setSourceKind(g.source_kind);
    setTitle(g.payload.presentation.title);
    setSections(g.payload.presentation.sections);
    setEntries(g.payload.grounding.sections);
    setAggGrounding(g.payload.grounding);
    setChartNotes((g.payload.chart_notes ?? []) as ChartNote[]);
    setTranscript(g.payload.transcript ?? null);
    setActiveSectionId(g.payload.presentation.sections[0]?.id ?? null);
    setStatus("done");
    setSummaryStatus("idle");
    setGuardando("idle");
    setCuentaAbierta(false);
    // Después de `resetForRun`, que acaba de vaciar el chat. Vuelve la conversación tal como
    // quedó, con sus anclas, y desde aquí los turnos nuevos se siguen guardando en esta misma.
    presentacionIdRef.current = g.id;
    chat.restaurar(g.chat);

    // Los artefactos generados NO se descargan aquí: el deck puede pesar megas y el mp3 puede que
    // nadie lo escuche. Se deja dicho que existen —con eso el botón ofrece abrir en vez de
    // generar— y se traen al pulsar.
    setDeckGuardado(g.tiene_deck);
    if (g.tiene_narracion) {
      narration.restaurar(urlDeLaNarracion(g.id), g.payload.presentation);
    }
  }

  function applyNonStreaming(data: TransformResponse) {
    setTranscript(data.transcript);
    setOriginal((prev) => (prev ? { ...prev, audioEvidence: data.audio_evidence } : prev));
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
    // El documento que se va a transformar, en la forma que entiende el punto único de envío.
    // Aquí siempre viene del navegador: `documentId` es para las presentaciones RESTAURADAS.
    const origen: OriginalSource = { text, file, audioEvidence: null, documentId: null };
    track("transform_submit", { source_kind: sk });
    resetForRun(text, file);
    setStatus("streaming");

    // Adelanto en PARALELO (Hito 5g): no se espera (no bloquea el streaming). Latencia real del
    // LLM liviano, sin sleep. Si falla, se marca como error y se muestra como tal (honestidad).
    //
    // El AUDIO es el único caso que no puede lanzarlo aquí: el modelo del adelanto no admite
    // audio como entrada. Se dispara más abajo, al llegar la transcripción de la fase de
    // percepción — que además es justo el momento en que hay algo que resumir. Para el usuario
    // la diferencia es que el adelanto del audio tarda un poco más, no que no exista.
    setSummaryStatus("loading");
    if (sk !== "audio") {
      fetchSummary(origen)
        .then((s) => {
          setSummary(s);
          setSummaryStatus("done");
        })
        .catch(() => setSummaryStatus("error"));
    }

    let received = 0;
    let docTitle = "";
    const collected: Section[] = []; // copia local de las secciones (para el post-pase de ilustraciones)
    try {
      await streamTransform(origen, (event) => {
        if (event.type === "transcript") {
          // Lo que la fase de percepción oyó. Alimenta el panel de fuente (transcripción con
          // la cita resaltada) y, de paso, el adelanto: ya es TEXTO, así que el modelo liviano
          // sí lo admite.
          setTranscript(event.text);
          // La evidencia se adjunta al DOCUMENTO: desde aquí el chat, las sugeridas y el deck
          // la reenvían solas, sin que ningún componente tenga que saber que existe.
          setOriginal((prev) => (prev ? { ...prev, audioEvidence: event.evidence } : prev));
          fetchSummary({ text: event.text, file: null, audioEvidence: null, documentId: null })
            .then((s) => {
              setSummary(s);
              setSummaryStatus("done");
            })
            .catch(() => setSummaryStatus("error"));
        } else if (event.type === "start") {
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
          const data = await postTransform(origen);
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
      openSectionSource(
        section,
        gstatus,
        idx >= 0 ? idx + 1 : null,
        entry?.start_s ?? null,
        entry?.region ?? null,
      );
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
    void quienSoy().then(setUsuario);
  }, []);

  useEffect(() => {
    initTelemetry();
    modeEnteredAtRef.current = Date.now(); // línea base del primer modo (resumen, al montar)
    const onHide = () => {
      const enteredAt = modeEnteredAtRef.current ?? Date.now();
      track("session_end", {
        // El tramo final puede ser la presentación generada, no solo un nivel de detalle: si se
        // reportara `detailLevelRef` se le sumaría a "detallado" un tiempo que no se pasó ahí.
        final_mode: modeBucketRef.current,
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
    // lleva el reloj de "cuándo entré a este tramo" y reporta cuánto duró el que deja.
    if (level === detailLevel) return; // clic redundante: no cuenta como cambio
    detailLevelRef.current = level;
    setDetailLevel(level);
    // Con la presentación generada abierta el control sigue visible pero no cambia nada de lo que
    // se ve, así que no hay tramo que cerrar: se guarda el nivel y se aplica al volver al contenido.
    if (modeBucketRef.current === "deck") return;
    cerrarTramo(level, ordinalOf(effectiveActiveId));
  }

  const hasContent = sections.length > 0;
  const streaming = status === "streaming";

  // Elegir una sección en el rail siempre lleva a ella. Con la presentación generada abierta (que
  // tiene sus propias diapositivas, no las secciones) se vuelve al contenido en esa sección, en
  // vez de dejar el clic sin efecto.
  function handleSelectSection(id: string) {
    setActiveSectionId(id);
    if (deckOpen) setDeckVisible(false);
  }

  return (
    <>
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
      acciones={
        <>
          {hasContent && usuario ? (
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando === "guardando"}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
            >
              {guardando === "guardando"
                ? "Guardando…"
                : guardando === "guardada"
                  ? "Guardada"
                  : guardando === "error"
                    ? "No se pudo guardar"
                    : "Guardar"}
            </button>
          ) : null}
          <AccountButton
            usuario={usuario}
            abierto={cuentaAbierta}
            onClick={() => setCuentaAbierta(!cuentaAbierta)}
          />
        </>
      }
      // «Ya existe», en memoria o guardada: una presentación restaurada ofrece abrirla, no
      // generar otra vez la que ya está hecha.
      deckReady={deck !== null || deckGuardado}
      deckAvailable={hasContent && original !== null}
      deckLoading={deckStatus === "loading"}
      deckError={deckStatus === "error"}
      onToggleDeck={toggleDeck}
      narrationStatus={narration.status}
      narrationAvailable={narration.available}
      onNarrationPlay={narration.play}
      onNarrationPause={narration.pause}
      onNarrationStop={narration.stop}
      narrationCurrentTime={narration.currentTime}
      narrationDuration={narration.duration}
      onNarrationSeek={narration.seek}
      onNarrationSkip={narration.skip}
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
              region={activeSource!.region}
              transcript={transcript}
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
          <DeckView deck={deck} onOpenSource={openDeckSource} />
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

    {/* El CAJÓN de cuenta: esto sí es una capa superpuesta, porque un cajón se desliza sobre el
        contenido y lo devuelve al cerrarse. El botón que lo abre NO vive aquí — está en la fila de
        controles de la cabecera, donde el `flex` le reserva sitio. Cuando flotaba también él, en
        ventanas estrechas se montaba encima de «Chat». */}
    {cuentaAbierta ? (
      <div className="fixed inset-0 z-40 flex justify-end">
        {/* El fondo oscurecido cierra al tocar fuera, pero se oculta a los lectores de pantalla:
            anunciaba "Cerrar el panel de cuenta" igual que la X del cajón, y oír dos veces la
            misma acción obliga a probar cuál es cuál. La X ya la ofrece. */}
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={() => setCuentaAbierta(false)}
          className="backdrop-enter flex-1 bg-black/25 backdrop-blur-[1px]"
        />
        <div className="drawer-enter h-full w-80 max-w-[85vw] border-l border-border shadow-2xl">
          <AccountPanel
            usuario={usuario}
            onUsuario={setUsuario}
            onAbrir={(id) => void restaurar(id)}
            onBorrada={(id) => {
              // Si se borró la que se está viendo, ya no hay dónde guardar su conversación. Sin
              // esto el chat seguiría mandando turnos contra un id que no existe: se perderían
              // en silencio, con la app aparentando que los guarda.
              if (presentacionIdRef.current === id) presentacionIdRef.current = null;
            }}
            onCerrar={() => setCuentaAbierta(false)}
          />
        </div>
      </div>
    ) : null}
    </>
  );
}
