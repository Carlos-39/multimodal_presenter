import type { Metadata } from "next";
import { connection } from "next/server";
import { BibliotecaClient } from "./BibliotecaClient";

/**
 * `/biblioteca`: lo que has guardado, como sitio propio y no como un cajón del perfil.
 *
 * Quien decide qué se ve es el cliente, tras preguntar si hay sesión. No se decide en el servidor
 * a propósito: una sesión revocada deja una cookie que sigue ahí y no vale nada, así que «tiene
 * cookie» no es «está dentro». Comprobarlo de verdad exigiría ir a la base en cada carga, y el
 * precio de no hacerlo es un esqueleto de medio segundo.
 */
export const metadata: Metadata = {
  title: "Tu biblioteca · Multimodal Presenter",
  description: "Los documentos que transformaste y guardaste.",
};

export default async function Page() {
  // Esta página se renderiza POR PETICIÓN, y no por nada de su contenido: es una de las que llevan
  // la política de contenido con nonce (ver `lib/csp.ts`), y un nonce solo existe cuando hay una
  // petición. Prerenderizada, sus scripts saldrían sin él y el navegador los bloquearía.
  //
  // No cuesta nada aquí: lo que se renderiza en el servidor es un esqueleto vacío, porque el
  // contenido lo pide el cliente después.
  await connection();
  return <BibliotecaClient />;
}
