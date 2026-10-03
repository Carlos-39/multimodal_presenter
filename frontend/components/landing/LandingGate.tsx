"use client";

import { useState } from "react";
import WorkspaceClient from "@/app/WorkspaceClient";
import { Landing } from "./Landing";

/**
 * La portada y lo que pasa al dejarla atrás.
 *
 * El servidor ya decidió que a esta visita le toca portada (ver `app/page.tsx`), así que el
 * primer render del cliente es el mismo y no hay desajuste de hidratación. Al entrar se monta el
 * Workspace **aquí mismo**, sin navegar: una navegación volvería a pedir la página al servidor
 * para acabar en el mismo sitio.
 *
 * La cookie es lo que hace que la próxima visita no vuelva a ver la portada. Se escribe desde el
 * cliente, pero la LEE el servidor, que es quien decide.
 */
const YA_ESTUVO = "mmp_visto_landing";
const UN_ANO = 60 * 60 * 24 * 365;

export function LandingGate() {
  const [dentro, setDentro] = useState(false);

  if (dentro) return <WorkspaceClient />;

  return (
    <Landing
      onEntrar={() => {
        // `SameSite=Lax` y sin `Secure` para que funcione igual en el `localhost` de las sesiones
        // de evaluación. No guarda nada de la persona: solo que ya vio la portada.
        document.cookie = `${YA_ESTUVO}=1; path=/; max-age=${UN_ANO}; SameSite=Lax`;
        setDentro(true);
      }}
    />
  );
}
