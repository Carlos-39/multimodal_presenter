/**
 * Avisos que se enseñan una sola vez en la vida.
 *
 * En `localStorage` y no en la base: es una preferencia de este navegador, no del usuario, y
 * atarla a la cuenta significaría una tabla, una migración y una petición más al cargar para algo
 * que, si se pierde, como mucho enseña una pista de más.
 *
 * Todo entre `try`/`catch` porque en modo privado, con el almacenamiento bloqueado o en una
 * ventana sin permisos, **leer ya lanza**. Si no se puede recordar, se decide no volver a enseñar:
 * molestar en cada carga es peor que no avisar nunca.
 */
const PREFIJO = "mmp_visto_";

export type Aviso = "biblioteca";

export function avisoPendiente(aviso: Aviso): boolean {
  try {
    return window.localStorage.getItem(PREFIJO + aviso) === null;
  } catch {
    return false;
  }
}

export function marcarAvisoVisto(aviso: Aviso): void {
  try {
    window.localStorage.setItem(PREFIJO + aviso, "1");
  } catch {
    // Sin almacenamiento no hay nada que recordar, y tampoco nada que arreglar.
  }
}
