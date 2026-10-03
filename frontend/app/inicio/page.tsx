import type { Metadata } from "next";
import { LandingVisita } from "@/components/landing/LandingVisita";

export const metadata: Metadata = {
  title: "Multimodal Presenter",
  description:
    "Entiende un documento difícil y comprueba cada frase. Sube un PDF, una grabación o un texto.",
};

/**
 * La dirección PERMANENTE de la portada.
 *
 * `/` es una puerta: la primera visita ve la portada y las siguientes van directas a la
 * aplicación. Eso está bien para quien llega, pero deja la portada sin dirección propia — y sin
 * ella no hay forma de volver. Era un defecto real: desde «Cómo se construyó», el enlace de
 * volver llevaba a `/` y, con la cookie puesta, aterrizaba en la aplicación.
 *
 * Aquí la portada siempre es la portada. Es a donde apuntan el enlace de volver del making of y
 * el nombre de la aplicación en su cabecera.
 */
export default function Inicio() {
  return <LandingVisita />;
}
