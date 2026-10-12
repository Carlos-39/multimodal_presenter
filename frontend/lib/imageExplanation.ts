/**
 * Explicación bajo demanda de una imagen REAL del documento (Hito 5h Parte 3).
 * Reusa la capacidad de visión del backend (Hito 4): el modelo relee el binario y explica la
 * imagen. La atribución es la propia imagen (se muestra junto a ella en el SourcePanel).
 */
export async function fetchImageExplanation(
  file: File,
  page: number | null,
  context: string | null,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  if (page != null) form.append("page", String(page));
  if (context) form.append("context", context);

  const res = await fetch("/api/explain-image", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const body = (await res.json()) as { explanation: string };
  return body.explanation;
}
