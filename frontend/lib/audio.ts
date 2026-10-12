import type { SourceKind } from "./types";

/**
 * Ayudantes puros de la entrada de audio (A1). Mismo criterio que `detail.ts` (5b),
 * `highlight.ts` (5c) y `workspace.ts` (5e): la lógica sin estado vive aquí y se testea
 * sola, no enterrada en un componente.
 */

/**
 * Tipo de fuente a partir del archivo que el usuario subió.
 *
 * Es una señal de la UI, no una autoridad: el backend decide el tipo real por *magic bytes*
 * (`uploads.py`) y el valor definitivo llega en `grounding.source_kind`. Sirve para que la
 * interfaz pinte lo correcto desde el primer momento, antes de la primera respuesta.
 */
export function sourceKindOf(file: File | null): SourceKind {
  if (!file) return "text";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("audio/")) return "audio";
  return "image";
}

/** Segundos → `m:ss`, para mostrar el momento de una cita (el análogo del nº de página). */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
