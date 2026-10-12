import { proxyToBackend } from "@/lib/proxyToBackend";

// Route handler (no rewrite): la generación de imágenes tarda ~20-30s y el rewrite corta la
// conexión (socket hang up). Ver lib/proxyToBackend.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return proxyToBackend(request, "/illustrations");
}
