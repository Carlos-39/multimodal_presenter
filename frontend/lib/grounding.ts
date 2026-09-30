import type { GroundingStatus } from "./types";

/**
 * Endurecimiento del grounding (Hito 8). Una sección `not_found` = su cita NO ancló al documento.
 * Ya no se presenta como confiable: NO se ofrece "ver fuente" (sería fingir una fuente que no
 * existe) y se muestra un aviso honesto. `verified` y `unverified` sí son anclables (verified con
 * resaltado exacto; unverified es el estado legítimo de PDF/imagen a la espera del Hito 5).
 *
 * Misma honestidad que el chat (Hito 6), que ya dice "Respuesta no anclada a la fuente".
 */
export function isAnchored(status: GroundingStatus): boolean {
  return status !== "not_found";
}

/** Aviso para una sección cuya cita no se pudo anclar al documento (deterministamente). */
export const UNANCHORED_NOTICE =
  "No se pudo anclar esta afirmación a una cita del documento. Verifícala manualmente.";
