/**
 * Que la portada no se interponga dos veces.
 *
 * Es una cookie y no `localStorage` porque **la lee el servidor**, que es quien decide qué se
 * sirve en `/` antes de pintar nada (ver `app/page.tsx`). No guarda nada de la persona: solo que
 * ya vio la portada.
 */
const YA_ESTUVO = "mmp_visto_landing";
const UN_ANO = 60 * 60 * 24 * 365;

export function recuerdaLaVisita(): void {
  // `SameSite=Lax` y sin `Secure` para que funcione igual en el `localhost` de las sesiones de
  // evaluación del Hito 8, que corren sin HTTPS.
  document.cookie = `${YA_ESTUVO}=1; path=/; max-age=${UN_ANO}; SameSite=Lax`;
}
