import { anexaDocumento } from "./documentForm";
import type { OriginalSource } from "./types";

/**
 * Adelanto inicial (Hito 5g): pide a POST /api/summary un resumen corto de lo subido.
 * Se llama EN PARALELO a la transformación en streaming, da un preview mientras el pipeline
 * completo trabaja. Es un extra no crítico: si falla, el frontend lo muestra como tal.
 */
export async function fetchSummary(original: OriginalSource): Promise<string> {
  const form = new FormData();
  anexaDocumento(form, original);

  const res = await fetch("/api/summary", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const body = (await res.json()) as { summary: string };
  return body.summary;
}
