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

export interface SectionGrounding {
  section_id: string;
  grounded: boolean;
  char_start: number | null;
  char_end: number | null;
}

export interface GroundingReport {
  sections: SectionGrounding[];
  total_sections: number;
  grounded_sections: number;
  ungrounded_sections: number;
}

/** Envelope de respuesta de POST /transform. */
export interface TransformResponse {
  presentation: Presentation;
  grounding: GroundingReport;
}
