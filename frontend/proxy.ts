import { NextResponse, type NextRequest } from "next/server";
import { PORTON, decide, esLaPropiaMaquina } from "@/lib/acceso";
import { politicaDeSeguridad } from "@/lib/csp";

/**
 * Lo que se decide ANTES de que exista la página.
 *
 * Se llama `proxy.ts` y no `middleware.ts` porque en Next 16 ese nombre quedó obsoleto: la
 * documentación que trae el propio paquete lo dice y la función se exporta como `proxy`.
 *
 * Hace dos cosas, y las dos tienen que pasar antes de que exista una respuesta:
 *
 * 1. **El portón**: si hay código configurado, nadie entra sin él. Ver `lib/acceso.ts`.
 * 2. **La política de contenido**, que necesita un *nonce* nuevo en cada petición y por eso no
 *    puede vivir en la configuración estática.
 *
 * **Corre antes que los `rewrites`**, y eso es justo lo que hace que el portón sirva de algo: el
 * orden documentado es cabeceras → redirecciones → *proxy* → `beforeFiles` → archivos →
 * `afterFiles`, y nuestro reenvío de `/api/*` es `afterFiles`. Un `curl` a `/api/transform/stream`
 * sin permiso se queda aquí y no llega al backend, que es donde costaría dinero.
 *
 * Y una advertencia que está en esa misma documentación y conviene respetar: esto «no debe confiar
 * en módulos compartidos ni en variables globales». Nada de lo que se haga aquí guarda estado
 * entre peticiones — por eso el contador de intentos no está aquí, sino en el login.
 */
export function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;

  const decision = decide({
    url: request.nextUrl,
    cookie: request.cookies.get(PORTON.COOKIE)?.value,
    codigo: process.env.ACCESO_CODIGO,
  });

  if (decision.tipo === "rechaza-api") {
    return NextResponse.json({ detail: "Necesitas el enlace de acceso." }, { status: 401 });
  }

  if (decision.tipo === "entra") {
    const respuesta = NextResponse.redirect(new URL(decision.volverA, request.url), 303);
    respuesta.cookies.set(PORTON.COOKIE, decision.cookie, {
      httpOnly: true, // el permiso no se toca desde JavaScript
      sameSite: "lax",
      // `Secure` salvo en la propia máquina. Se mira el HOST y no `NODE_ENV` a propósito: una
      // cookie `Secure` sobre http no se guarda, así que atarla al modo dejaba un bucle de
      // redirecciones en cuanto alguien levantara la build de producción en local para probarla.
      // Y `localhost` ya cuenta como origen de confianza para el navegador, así que no se pierde
      // nada. Donde esto viva de verdad habrá https y la cookie irá marcada.
      secure: !esLaPropiaMaquina(request.nextUrl.hostname),
      maxAge: PORTON.DURACION_S,
      path: "/",
    });
    return respuesta;
  }

  if (decision.tipo === "pide-codigo") {
    const destino = new URL(PORTON.RUTA, request.url);
    destino.searchParams.set("destino", decision.destino);
    return NextResponse.redirect(destino, 303);
  }

  // Las respuestas de `/api/*` no son documentos que el navegador renderice: son JSON, bytes de un
  // PDF o un flujo de eventos. Una política de contenido ahí no protege nada y sí puede estorbar
  // al visor nativo de PDF del navegador, que es quien pinta la fuente.
  if (ruta.startsWith("/api/")) return NextResponse.next();

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const politica = politicaDeSeguridad(ruta, nonce, process.env.NODE_ENV === "development");

  // La cabecera va en la PETICIÓN además de en la respuesta: Next lee de ahí el nonce para
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
