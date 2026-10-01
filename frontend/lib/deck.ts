import type { GeneratedDeck } from "./types";

/**
 * Presentación generada en diapositivas (guion propio, desde la fuente). Bajo demanda. Relee el
 * documento original en el backend y sintetiza un deck pensado para slides.
 */
export async function fetchDeck(text: string | null, file: File | null): Promise<GeneratedDeck> {
  const form = new FormData();
  if (text && text.trim().length > 0) form.append("text", text.trim());
  if (file) form.append("file", file);

  const res = await fetch("/api/deck", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json()) as GeneratedDeck;
}
