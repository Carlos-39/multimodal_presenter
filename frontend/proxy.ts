import { NextResponse, type NextRequest } from "next/server";
import { politicaDeSeguridad } from "@/lib/csp";

/**
 * La política de contenido de cada página, decidida antes de que exista la respuesta.
 *
 * Se llama `proxy.ts` y no `middleware.ts` porque en Next 16 ese nombre quedó obsoleto y la
 * función se exporta como `proxy`. Vive aquí y no en la configuración estática porque necesita un
 * *nonce* nuevo en cada petición.
 *
 * La documentación de Next advierte que esto no debe depender de módulos compartidos ni de
 * variables globales, así que no guarda estado entre peticiones.
 */
export function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;

  // Las respuestas de `/api/*` no son documentos que el navegador renderice: son JSON, bytes de un
  // PDF o un flujo de eventos. Una política de contenido ahí no protege nada y sí puede estorbar
  // al visor nativo de PDF del navegador, que es quien pinta la fuente.
  if (ruta.startsWith("/api/")) return NextResponse.next();

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const politica = politicaDeSeguridad(ruta, nonce, process.env.NODE_ENV === "development");

  // La cabecera va en la petición además de en la respuesta: Next lee de ahí el nonce para
  // ponérselo a sus propios scripts. Sin eso, la política bloquearía al propio framework.
  const cabeceras = new Headers(request.headers);
  cabeceras.set("content-security-policy", politica);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("content-security-policy", politica);
  return respuesta;
}

export const config = {
  matcher: [
    {
      // Todo menos los archivos que se sirven tal cual. Sin esta exclusión el proxy correría
      // también sobre el CSS y las fuentes, que no son documentos y no llevan política.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      // Las precargas de `next/link` piden la página sin mostrarla; no hace falta gastarles un
      // nonce que nadie va a usar.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
