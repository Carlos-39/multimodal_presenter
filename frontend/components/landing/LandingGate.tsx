"use client";

import { useState } from "react";
import WorkspaceClient from "@/app/WorkspaceClient";
import { Landing } from "./Landing";
import { recuerdaLaVisita } from "./recuerdo";

/**
 * La portada cuando es la PRIMERA visita, en `/`.
 *
 * El servidor ya decidió que a esta visita le toca portada (ver `app/page.tsx`), así que el primer
 * render del cliente es el mismo y no hay desajuste de hidratación. Al entrar se monta la
 * aplicación **aquí mismo**, sin navegar: ya estamos en `/`, que es su dirección, y una
 * navegación solo pediría la página otra vez para acabar en el mismo sitio.
 *
 * La portada tiene además su dirección propia en `/inicio`, que es a donde se vuelve desde la
 * aplicación y desde el making of.
 */
export function LandingGate() {
  const [dentro, setDentro] = useState(false);

  if (dentro) return <WorkspaceClient />;

  return (
    <Landing
      onEntrar={() => {
        recuerdaLaVisita();
        setDentro(true);
      }}
    />
  );
}
