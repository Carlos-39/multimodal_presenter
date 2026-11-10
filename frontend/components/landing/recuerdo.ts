/**
 * Que la portada no se interponga dos veces en la misma visita.
 *
 * Es una cookie y no `localStorage` porque la lee el servidor, que es quien decide qué se
 * sirve en `/` antes de pintar nada (ver `app/page.tsx`). No guarda nada de la persona: solo que
 * ya pasó por la portada.
 *
 * Es una cookie de sesión, sin caducidad: dura mientras el navegador siga abierto. Así una
 * recarga o un enlace interno a `/` llevan a la aplicación, pero quien vuelve otro día, o abre el
 * enlace por primera vez, ve primero la portada.
 */
export const YA_ESTUVO = "mmp_dentro";

export function recuerdaLaVisita(): void {
  // `SameSite=Lax` y sin `Secure` para que funcione igual en un `localhost` sin HTTPS.
  try {
    document.cookie = `${YA_ESTUVO}=1; path=/; SameSite=Lax`;
  } catch {
    // Con las cookies bloqueadas no se puede recordar la visita, pero entrar tiene que funcionar:
    // la portada simplemente volverá a salir al recargar.
  }
}
