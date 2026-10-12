import { anexaDocumento } from "./documentForm";
import type { OriginalSource } from "./types";
import type { GeneratedDeck } from "./types";

/**
 * Presentación generada en diapositivas (guion propio, desde la fuente). Bajo demanda. Relee el
 * documento original en el backend y sintetiza un deck pensado para slides.
 */
export async function fetchDeck(original: OriginalSource): Promise<GeneratedDeck> {
  const form = new FormData();
  anexaDocumento(form, original);
  if (original.audioEvidence) form.append("audio_evidence", original.audioEvidence);

  const res = await fetch("/api/deck", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return (await res.json()) as GeneratedDeck;
}
