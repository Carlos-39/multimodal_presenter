import { proxyToBackend } from "@/lib/proxyToBackend";

// Route handler (no rewrite): explicar una imagen real tarda ~10s; el rewrite corta la conexión.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/explain-image");
}
