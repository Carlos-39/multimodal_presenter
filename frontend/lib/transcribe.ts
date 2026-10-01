/**
 * Entrada por voz: envía el audio grabado a POST /api/transcribe y devuelve el texto.
 * Solo audio→texto; el usuario revisa y envía manualmente (nunca se envía ni se interpreta como
 * comando). Falla visible: lanza si el backend responde error.
 */
export async function fetchTranscription(audio: Blob): Promise<string> {
  const ext = audio.type.includes("ogg")
    ? "ogg"
    : audio.type.includes("mp4")
      ? "mp4"
      : "webm";
  const form = new FormData();
  form.append("file", audio, `pregunta.${ext}`);

  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const body = (await res.json()) as { text: string };
  return body.text;
}
