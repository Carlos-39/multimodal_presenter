import type { Metadata } from "next";
import { BibliotecaClient } from "./BibliotecaClient";

/**
 * `/biblioteca`: lo que has guardado, como sitio propio y no como un cajón del perfil.
 *
 * La página es estática y quien decide qué se ve es el cliente, tras preguntar si hay sesión. No
 * se decide en el servidor a propósito: una sesión revocada deja una cookie que sigue ahí y no
 * vale nada, así que «tiene cookie» no es «está dentro». Comprobarlo de verdad exigiría ir a la
 * base en cada carga, y el precio de no hacerlo es un esqueleto de medio segundo.
 */
export const metadata: Metadata = {
  title: "Tu biblioteca · Multimodal Presenter",
  description: "Los documentos que transformaste y guardaste.",
};

export default function Page() {
  return <BibliotecaClient />;
}
