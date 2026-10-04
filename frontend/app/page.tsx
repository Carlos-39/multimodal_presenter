import { cookies } from "next/headers";
import { LandingGate } from "@/components/landing/LandingGate";
import WorkspaceClient from "./WorkspaceClient";

/**
 * Qué se ve al abrir `/`: la presentación del producto, o la aplicación.
 *
 * **La decisión es del SERVIDOR, y por eso se apoya en cookies y no en `localStorage`.** La
 * primera versión decidía en el cliente: el servidor, que no tiene `localStorage`, renderizaba la
 * aplicación y el cliente la portada, y React avisaba del desajuste de hidratación. Una decisión
 * de enrutado tomada antes de pintar no puede depender de algo que solo existe en el navegador.
 * Así tampoco hay parpadeo: llega resuelta.
 *
 * Vive en un componente aparte del Workspace porque los hooks del Workspace **arrancan la
 * telemetría del Hito 8 al montarse**. Si la portada fuera una rama dentro de él, una visita que
 * solo lee la portada abriría una sesión de medición. Comprobado: leyendo la portada no se crea
 * `mmp_session_id`; al entrar, sí.
 */
const YA_ESTUVO = "mmp_visto_landing";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [parametros, galletas] = await Promise.all([searchParams, cookies()]);

  // Una sesión de evaluación del Hito 8 va DIRECTA a la aplicación. Esas sesiones abren `/?p=Pxx`
  // sin cuenta, y meterles una portada delante añadiría fricción y un modo de fallo delante del
  // participante, justo en algo que no se puede repetir.
  if (parametros.p !== undefined) return <WorkspaceClient />;

  // Quien ya entró alguna vez no necesita que le presenten.
  //
  // Se mira el VALOR y no la presencia: cerrar sesión no borra una cookie, la deja vacía, y
  // `has()` la sigue dando por presente.
  //
  // Y NO se mira la cookie de sesión, aunque tentara: una sesión revocada deja un token que sigue
  // ahí, no vacío y sin valer nada, así que "tiene cookie de sesión" no es "está dentro".
  // Comprobarlo de verdad exigiría ir a la base en cada carga de la portada. El caso que cubría
  // —estar dentro en un navegador que nunca vio la portada— se resuelve solo: se ve una vez y se
  // entra con un clic.
  if (galletas.get(YA_ESTUVO)?.value) return <WorkspaceClient />;

  return <LandingGate />;
}
