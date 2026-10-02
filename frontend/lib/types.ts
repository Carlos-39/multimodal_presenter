/**
 * Tipos del contrato backend↔frontend.
 *
 * Espejo del contrato Pydantic del backend (`schemas/presentation.py` y
 * `schemas/transform.py`). Mantiene la misma disciplina: `SectionContent` es una
 * discriminated union sobre `content_type`, igual que en el backend, de modo que el
 * render por tipo sea exhaustivo y no se pueda desalinear tipo↔contenido.
 *
 * TODO: si el contrato crece, evaluar generar estos tipos desde el /openapi.json del
 * backend (openapi-typescript) para una única fuente de verdad.
 */

export type SectionRole = "core" | "satellite";
export type ChartType = "line" | "bar" | "pie" | "scatter";

/** Estado del adelanto inicial (Hito 5g): sin pedir, en curso, listo o fallido. */
export type SummaryStatus = "idle" | "loading" | "done" | "error";

export interface SourceReference {
  document_id: string;
  quote: string;
  page: number | null;
  char_start: number | null;
  char_end: number | null;
}

export interface TextContent {
  content_type: "text";
  text: string;
}

export interface TableContent {
  content_type: "table";
  columns: string[];
  rows: (string | number)[][];
}

export interface TimelineEvent {
  date: string;
  label: string;
  description?: string | null;
}

export interface TimelineContent {
  content_type: "timeline";
  events: TimelineEvent[];
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  categories: string[];
  series: ChartSeries[];
}

export interface ChartContent {
  content_type: "chart";
  chart_type: ChartType;
  data: ChartData;
}

export type SectionContent =
  | TextContent
  | TableContent
  | TimelineContent
  | ChartContent;

/**
 * Ilustración de apoyo GENERADA (Hito 5h Parte 1). NO es contenido trazable: no tiene `source` ni
 * estado de grounding. Siempre se muestra con su etiqueta permanente.
 */
export interface GeneratedIllustration {
  kind: "generated_illustration";
  image_url: string;
  alt: string;
  label: string;
}

export interface Section {
  id: string;
  title: string | null;
  role: SectionRole;
  source: SourceReference;
  content: SectionContent;
  illustration?: GeneratedIllustration | null;
}

/**
 * Presentación GENERADA en diapositivas (guion propio, desde la fuente). Artefacto on-demand,
 * separado de `Presentation`. Trazabilidad por slide: `source` anclada, o `is_synthesis` si es una
 * simplificación declarada.
 */
export interface GeneratedSlide {
  title: string;
  body: string | null;
  bullets: string[];
  source: SourceReference | null;
  grounding: GroundingStatus;
  is_synthesis: boolean;
  illustration: GeneratedIllustration | null;
}

export interface GeneratedDeck {
  slides: GeneratedSlide[];
}

export interface Presentation {
  title: string;
  sections: Section[];
}

export type GroundingStatus = "verified" | "unverified" | "not_found";
export type SourceKind = "text" | "pdf" | "image" | "audio";

export interface SectionGrounding {
  section_id: string;
  status: GroundingStatus;
  char_start: number | null;
  char_end: number | null;
  page: number | null;
  /**
   * Solo audio: momento aproximado del que viene la cita, para llevar el reproductor ahí (el
   * análogo de `page` en PDF). El estado sigue siendo `unverified`: la cita se LOCALIZA en la
   * transcripción del modelo de percepción, no se verifica contra la señal.
   */
  start_s: number | null;
}

export interface GroundingReport {
  source_kind: SourceKind;
  sections: SectionGrounding[];
  total_sections: number;
  verified_sections: number;
  unverified_sections: number; // PDF/imagen: pendiente de verificación (Hito 5)
  not_found_sections: number; // texto: cita no encontrada = warnings reales
}

/** Nota determinista sobre un gráfico tras la regla de isomorfismo (Hito 5a). */
export interface ChartNote {
  section_id: string;
  kind: "corrected" | "degraded";
  detail: string;
}

export interface SemanticObservation {
  section_id: string;
  issue: string;
}

export interface SemanticCoherenceReport {
  observations: SemanticObservation[];
}

/** Envelope de respuesta de POST /transform (no-streaming). */
export interface TransformResponse {
  presentation: Presentation;
  grounding: GroundingReport;
  semantic: SemanticCoherenceReport;
  chart_notes: ChartNote[];
  /** Solo audio: lo que oyó la fase de percepción. `null` para texto, PDF e imagen. */
  transcript: string | null;
  /** Solo audio: la evidencia acústica serializada, bloque opaco que se reenvía. */
  audio_evidence: string | null;
}

/** Eventos SSE de POST /transform/stream (Hito 5d). */
export type StreamEvent =
  /**
   * Solo audio: lo que la fase de percepción oyó, emitido ANTES del título. Llega durante los
   * segundos que esa fase consume, así que es lo que llena el adelanto del audio; y alimenta la
   * transcripción con la cita resaltada del panel de fuente.
   *
   * No es verificable contra la señal: es lo que el modelo oyó, y la UI lo dice.
   */
  | { type: "transcript"; text: string; speaker_count: number; evidence: string }
  | { type: "start"; title: string }
  | {
      type: "section";
      section: Section;
      grounding: SectionGrounding;
      chart_note: ChartNote | null;
    }
  | {
      type: "done";
      grounding: GroundingReport;
      semantic: SemanticCoherenceReport;
      chart_notes: ChartNote[];
    }
  | { type: "error"; message: string };

// ── Chat anclado a fuentes (Hito 6) ──

/** Un turno del historial (vive en el estado del frontend; no se persiste). */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/** Cognitive Forcing Function (opción D): pedido de aclaración ante ambigüedad real.
 * Invitación de cortesía, nunca un obstáculo; `options` son interpretaciones clicables (opcional). */
export interface ClarificationNeeded {
  question: string;
  options: string[];
}

/** Respuesta del chat: contenido renderizable (misma union del contrato) + anclaje verificado.
 * Si `clarification` está presente, este turno pide aclaración y no es una respuesta anclada. */
export interface ChatResponse {
  content: SectionContent;
  source: SourceReference | null; // null = no se pudo anclar
  grounding: GroundingStatus;
  clarification?: ClarificationNeeded | null;
  /** Solo audio: momento de la cita, para que el reproductor del panel salte ahí. */
  start_s?: number | null;
}

/** Eventos SSE de POST /chat/stream. Texto en vivo; el ancla llega en `done`. */
export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; response: ChatResponse }
  | { type: "error"; message: string };
