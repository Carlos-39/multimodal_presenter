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

export interface Section {
  id: string;
  title: string | null;
  role: SectionRole;
  source: SourceReference;
  content: SectionContent;
}

export interface Presentation {
  title: string;
  sections: Section[];
}

export type GroundingStatus = "verified" | "unverified" | "not_found";
export type SourceKind = "text" | "pdf" | "image";

export interface SectionGrounding {
  section_id: string;
  status: GroundingStatus;
  char_start: number | null;
  char_end: number | null;
  page: number | null;
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
}

/** Eventos SSE de POST /transform/stream (Hito 5d). */
export type StreamEvent =
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

/** Respuesta del chat: contenido renderizable (misma union del contrato) + anclaje verificado. */
export interface ChatResponse {
  content: SectionContent;
  source: SourceReference | null; // null = no se pudo anclar
  grounding: GroundingStatus;
}

/** Eventos SSE de POST /chat/stream. Texto en vivo; el ancla llega en `done`. */
export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; response: ChatResponse }
  | { type: "error"; message: string };
