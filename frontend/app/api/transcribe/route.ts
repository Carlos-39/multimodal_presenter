import { proxyToBackend } from "@/lib/proxyToBackend";

// Route handler (no rewrite): la transcripción de voz puede tardar varios segundos; se proxea
// server-side para evitar el corte de conexión del rewrite en respuestas lentas.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/transcribe");
}
