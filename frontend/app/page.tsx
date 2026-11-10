import { cookies } from "next/headers";
import { LandingGate } from "@/components/landing/LandingGate";
import WorkspaceClient from "./WorkspaceClient";

/**
 * Qué se ve al abrir `/`: la presentación del producto, o la aplicación.
 *
 * La decisión es del SERVIDOR, y por eso se apoya en cookies y no en `localStorage`. Decidir en
 * el cliente daría un desajuste de hidratación: el servidor, que no tiene `localStorage`,
 * renderizaría la aplicación y el cliente la portada. Una decisión de enrutado tomada antes de
 * pintar no puede depender de algo que solo existe en el navegador.
 * Así tampoco hay parpadeo: llega resuelta.
 *
 * Vive en un componente aparte del Workspace porque los hooks del Workspace arrancan la
 * telemetría al montarse. Si la portada fuera una rama dentro de él, una visita que solo lee la
 * portada abriría una sesión de medición: leyendo la portada no se crea `mmp_session_id`; al
 * entrar, sí.
 */
const YA_ESTUVO = "mmp_visto_landing";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [parametros, galletas] = await Promise.all([searchParams, cookies()]);

  // Con la etiqueta opcional de sesión (`/?p=Pxx`) se va DIRECTO a la aplicación, sin portada
  // delante.
  if (parametros.p !== undefined) return <WorkspaceClient />;

  // Llegas de la biblioteca a abrir algo concreto: ni portada ni nada en medio. El parámetro es
  // `abrir` y no `p` porque `p` ya es la etiqueta de sesión de la telemetría, y colisionar con
  // ella mandaría esa sesión a restaurar una presentación ajena.
  const abrir = typeof parametros.abrir === "string" ? parametros.abrir : undefined;
  if (abrir) return <WorkspaceClient abrir={abrir} />;

  // Quien ya entró alguna vez no necesita que le presenten.
  //
  // Se mira el VALOR y no la presencia: cerrar sesión no borra una cookie, la deja vacía, y
  // `has()` la sigue dando por presente.
  //
  // Y NO se mira la cookie de sesión, aunque tentara: una sesión revocada deja un token que sigue
  // ahí, no vacío y sin valer nada, así que "tiene cookie de sesión" no es "está dentro".
  // Comprobarlo exigiría ir a la base en cada carga de la portada. El caso que cubría
  // (estar dentro en un navegador que nunca vio la portada) se resuelve solo: se ve una vez y se
  // entra con un clic.
  if (galletas.get(YA_ESTUVO)?.value) return <WorkspaceClient />;

  return <LandingGate />;
}
