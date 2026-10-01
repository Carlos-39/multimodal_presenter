import { proxyToBackend } from "@/lib/proxyToBackend";

// Route handler (no rewrite): generar el deck (Sonnet + imágenes) tarda decenas de segundos; el
// rewrite corta la conexión. Ver lib/proxyToBackend.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/deck");
}
