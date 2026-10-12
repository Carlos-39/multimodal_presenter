"use client";

import { useRouter } from "next/navigation";
import { Landing } from "./Landing";
import { recuerdaLaVisita } from "./recuerdo";

/**
 * La portada cuando se llega a ella **a propósito** (`/inicio`), no por ser la primera visita.
 *
 * Aquí entrar NAVEGA a `/` en vez de montar la aplicación encima: quien vino a mirar la portada
 * tiene una dirección en la barra, y acabar viendo la aplicación bajo `/inicio` dejaría la URL
 * mintiendo sobre lo que hay en pantalla.
 */
export function LandingVisita() {
  const router = useRouter();
  return (
    <Landing
      onEntrar={() => {
        recuerdaLaVisita();
        router.push("/");
      }}
    />
  );
}
