/**
 * Preferencias de interfaz de ESTE navegador.
 *
 * Mismo razonamiento que `avisos.ts`, y por eso no vive allí: aquello recuerda lo que ya se
 * enseñó una vez, esto recuerda cómo quiere alguien ver la pantalla. Son dos cosas distintas que
 * casualmente se guardan igual.
 *
 * En `localStorage` y no en la cuenta: es una preferencia del aparato, no de la persona. Atarla a
 * la cuenta costaría una tabla, una migración y una petición más al cargar, para algo que si se
 * pierde solo deja un panel abierto de más.
 *
 * Hay además una copia en memoria, y no es redundante: en modo privado o con el almacenamiento
 * bloqueado, guardar no guarda nada, y sin la copia el control se quedaría pulsándose sin que la
 * pantalla cambiara. Con ella la elección vale al menos lo que dure la pestaña.
 */
const PREFIJO = "mmp_pref_";

export type Preferencia = "sugeridas_plegadas";

/** Lo elegido en esta página. Manda sobre el disco: es más reciente, y siempre está disponible. */
const enMemoria = new Map<Preferencia, boolean>();

export function leerPreferencia(preferencia: Preferencia, pordefecto: boolean): boolean {
  const reciente = enMemoria.get(preferencia);
  if (reciente !== undefined) return reciente;
  try {
    // En modo privado o con el almacenamiento bloqueado, **leer ya lanza**.
    const guardado = window.localStorage.getItem(PREFIJO + preferencia);
    return guardado === null ? pordefecto : guardado === "1";
  } catch {
    return pordefecto;
  }
}

/**
 * Quién quiere enterarse de que una preferencia cambió.
 *
 * Existe para que los componentes lean esto con `useSyncExternalStore` en vez de con un efecto
 * que llama a `setState`. La diferencia no es de estilo: en el render del servidor no hay
 * `localStorage`, así que leerlo sin más haría que servidor y navegador pinten cosas distintas
 * —un error de hidratación—, y corregirlo después desde un efecto es justo el patrón que React
 * desaconseja. `useSyncExternalStore` admite un valor para el servidor y otro para el cliente,
 * que es exactamente la forma de este problema.
 *
 * Sin sincronizar entre pestañas a propósito: dos pestañas abiertas son dos vistas, y que plegar
 * algo en una mueva la otra por debajo sobresalta más de lo que ayuda.
 */
const oyentes = new Set<() => void>();

export function suscribirPreferencias(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  return () => void oyentes.delete(alCambiar);
}

export function guardarPreferencia(preferencia: Preferencia, valor: boolean): void {
  enMemoria.set(preferencia, valor);
  try {
    window.localStorage.setItem(PREFIJO + preferencia, valor ? "1" : "0");
  } catch {
    // Sin almacenamiento la elección dura lo que dure la pestaña, que es mejor que nada.
  }
  for (const oyente of oyentes) oyente();
}
