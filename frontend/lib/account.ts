/**
 * Cuenta y biblioteca: el cliente de los endpoints que SÍ exigen iniciar sesión.
 *
 * El resto de la aplicación no pasa por aquí, y es deliberado: sin cuenta todo sigue funcionando
 * igual que antes. Las sesiones de evaluación del Hito 8 corren sin login, así que entrar añade
 * *guardar y volver*, no habilita usar el sistema.
 *
 * La sesión viaja en una cookie `HttpOnly`, así que aquí no hay ningún token que manejar: el
 * navegador la manda sola. Eso es justamente lo que impide que un XSS se la lleve.
 */

import type {
  ChatResponse,
  GeneratedDeck,
  GroundingReport,
  Presentation,
  SourceKind,
} from "./types";

export interface Usuario {
  id: string;
  email: string;
}

export interface ResumenPresentacion {
  id: string;
  titulo: string;
  document_id: string;
  source_kind: SourceKind;
  nombre_archivo: string | null;
  creada_en: string;
}

export interface PayloadGuardado {
  presentation: Presentation;
  grounding: GroundingReport;
  chart_notes?: unknown[];
  transcript?: string | null;
  audio_evidence?: string | null;
}

/**
 * Un mensaje del chat tal como se guarda.
 *
 * Lleva el `ChatResponse` completo y no solo el texto: lo que hay que poder volver a mostrar es la
 * respuesta CON su ancla. Una respuesta restaurada sin su cita sería una afirmación sin respaldo.
 */
export interface MensajeGuardado {
  rol: "user" | "assistant";
  texto: string;
  respuesta?: ChatResponse | null;
}

export interface PresentacionCompleta extends ResumenPresentacion {
  media_type: string | null;
  payload: PayloadGuardado;
  /** La conversación viene en la MISMA respuesta: restaurar es un solo acto, no dos. */
  chat: MensajeGuardado[];
  /**
   * Qué artefactos HAY, no los artefactos. Un deck con ilustraciones pesa megas y puede que
   * nadie lo abra; abrir una presentación tiene que ser inmediato. Saber que existe basta para
   * que el botón diga «Abrir presentación» en vez de ofrecer generarla otra vez.
   */
  tiene_deck: boolean;
  tiene_narracion: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detalle = `Error ${res.status}`;
    try {
      const cuerpo = await res.json();
      if (typeof cuerpo?.detail === "string") detalle = cuerpo.detail;
    } catch {
      // sin cuerpo JSON
    }
    throw new Error(detalle);
  }
  return (await res.json()) as T;
}

export async function registrarse(email: string, contrasena: string): Promise<Usuario> {
  return json(
    await fetch("/api/auth/registro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, contrasena }),
    }),
  );
}

export async function entrar(email: string, contrasena: string): Promise<Usuario> {
  return json(
    await fetch("/api/auth/entrar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, contrasena }),
    }),
  );
}

export async function salir(): Promise<void> {
  await fetch("/api/auth/salir", { method: "POST" });
}

/** Quién está dentro, o `null`. No lanza: no tener sesión es normal, no un error. */
export async function quienSoy(): Promise<Usuario | null> {
  try {
    const res = await fetch("/api/auth/yo");
    return res.ok ? ((await res.json()) as Usuario) : null;
  } catch {
    return null;
  }
}

export async function misPresentaciones(): Promise<ResumenPresentacion[]> {
  const cuerpo = await json<{ presentaciones: ResumenPresentacion[] }>(
    await fetch("/api/biblioteca/presentaciones"),
  );
  return cuerpo.presentaciones;
}

/**
 * Guarda una presentación junto con el documento del que salió.
 *
 * El documento viaja aquí y no se guarda solo al transformar: así no se almacena el documento de
 * quien nunca pidió guardar nada. Guardar es un acto explícito y lleva consigo lo que hace falta
 * para que lo guardado siga sirviendo.
 */
export async function guardarPresentacion(
  titulo: string,
  payload: PayloadGuardado,
  documento: { text: string | null; file: File | null },
): Promise<ResumenPresentacion> {
  const form = new FormData();
  form.append("titulo", titulo);
  form.append("payload", JSON.stringify(payload));
  if (documento.text) form.append("text", documento.text);
  if (documento.file) form.append("file", documento.file);
  return json(await fetch("/api/biblioteca/presentaciones", { method: "POST", body: form }));
}

export async function abrirPresentacion(id: string): Promise<PresentacionCompleta> {
  return json(await fetch(`/api/biblioteca/presentaciones/${id}`));
}

/**
 * Deja guardada la conversación de una presentación tal como está ahora.
 *
 * Manda el historial COMPLETO y reemplaza al anterior. Mandar solo el turno nuevo sería más
 * barato, pero lo guardado podría derivar de la conversación real —un reintento duplica un turno,
 * una petición perdida deja un hueco— y un historial con huecos es peor que ninguno, porque
 * parece completo.
 *
 * No lanza. Perder un turno del historial no puede romper el chat que se está usando: la
 * conversación en pantalla sigue siendo la verdadera, y el siguiente turno vuelve a mandarla
 * entera, así que un fallo suelto se corrige solo.
 */
export async function guardarChat(
  presentacionId: string,
  mensajes: MensajeGuardado[],
): Promise<void> {
  try {
    await fetch(`/api/biblioteca/presentaciones/${presentacionId}/chat`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mensajes }),
    });
  } catch {
    // ver arriba: se reintenta solo en el turno siguiente
  }
}

/**
 * El TEXTO de un documento guardado.
 *
 * Las fuentes binarias se resuelven por URL (el panel apunta al endpoint y el navegador descarga),
 * pero el texto plano no: el panel lo resalta carácter a carácter, así que necesita la cadena.
 * Sin esto, una presentación de texto restaurada abría un panel de fuente VACÍO — se podía leer
 * pero no verificar, que es justo lo que no puede pasar.
 */
export async function textoDelDocumento(documentId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/biblioteca/documentos/${documentId}`);
    return res.ok ? await res.text() : null;
  } catch {
    return null; // sin el texto el resto sigue usable; el panel lo dirá por sí mismo
  }
}

/**
 * Guarda el deck generado de una presentación.
 *
 * No lanza, por lo mismo que el chat: lo que se está viendo ya está bien, y si el guardado falla
 * lo peor que pasa es que la próxima vez haya que generarlo otra vez.
 */
export async function guardarDeck(presentacionId: string, deck: GeneratedDeck): Promise<void> {
  try {
    await fetch(`/api/biblioteca/presentaciones/${presentacionId}/artefactos/deck`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(deck),
    });
  } catch {
    // ver arriba
  }
}

/** El deck guardado. Se pide al pulsar para verlo, no al restaurar: puede pesar megas. */
export async function deckGuardado(presentacionId: string): Promise<GeneratedDeck> {
  return json(await fetch(`/api/biblioteca/presentaciones/${presentacionId}/artefactos/deck`));
}

/** Guarda el mp3 de la narración tal cual. No lanza, por lo mismo que el deck. */
export async function guardarNarracion(presentacionId: string, audio: Blob): Promise<void> {
  try {
    await fetch(`/api/biblioteca/presentaciones/${presentacionId}/artefactos/narracion`, {
      method: "PUT",
      headers: { "content-type": "audio/mpeg" },
      body: audio,
    });
  } catch {
    // ver arriba
  }
}

/**
 * De dónde leer la narración guardada.
 *
 * Es una URL y no los bytes: el reproductor se la pasa a un `<audio>`, que descarga por su cuenta
 * y puede empezar a sonar antes de tener el archivo entero.
 */
export function urlDeLaNarracion(presentacionId: string): string {
  return `/api/biblioteca/presentaciones/${presentacionId}/artefactos/narracion`;
}

export async function borrarPresentacion(id: string): Promise<void> {
  const res = await fetch(`/api/biblioteca/presentaciones/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error ${res.status}`);
}
