import type { GeneratedIllustration, Section } from "./types";

/**
 * Ilustraciones de apoyo generadas (Hito 5h Parte 1). Se piden tras la transformación, SOLO para
 * documentos de fuente texto (condición 1: un texto no trae imágenes propias). El backend decide
 * qué secciones califican (rúbrica) y genera la imagen; aquí solo se transporta el resultado.
 * Es un extra no crítico: si falla, no se muestra ilustración (no rompe la presentación).
 */
interface IllustrationItem {
  section_id: string;
  illustration: GeneratedIllustration;
}

export async function fetchIllustrations(presentation: {
  title: string;
  sections: Section[];
}): Promise<IllustrationItem[]> {
  const res = await fetch("/api/illustrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ presentation }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const body = (await res.json()) as { illustrations: IllustrationItem[] };
  return body.illustrations;
}
