import { proxyToBackend } from "@/lib/proxyToBackend";

// Route handler (no rewrite): la narración (guion + TTS) tarda ~17s; el rewrite corta la conexión.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/narration");
}
