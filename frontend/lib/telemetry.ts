/**
 * Telemetría de comportamiento (Hito 8, Parte A), capa observacional del frontend.
 *
 * Punto ÚNICO de la responsabilidad "telemetría": id de sesión, contador, buffer y envío en lote.
 * Es un módulo singleton a propósito (no un contexto/prop-drilling): la telemetría es un concern
 * transversal, y así el componente que CONOCE el origen de una señal (p. ej. el ChatPanel, único
 * que distingue una pregunta sugerida de una escrita) la emite donde nace, sin enterrarla.
 *
 * Privacidad (Hito 8): NUNCA se manda contenido de documentos ni texto de preguntas. Solo
 * metadatos: qué control, cuándo, cuánto tiempo, qué tipo, ordinales, longitudes. El backend
 * además corta strings largos como barrera final.
 *
 * Invisible para el participante: todo es fire-and-forget; si el endpoint falla, la UI no se entera.
 *
 * ## Un evento no se da por entregado hasta que el servidor lo dice
 *
 * La primera versión vaciaba el buffer ANTES de saber si el envío había llegado, y el fallo del
 * `fetch` se descartaba en silencio. En las dos sesiones reales de la primera prueba se perdieron
 * 8 de 60 eventos (un 13 %), y se vieron porque `seq` es un contador sin huecos: faltaban el 3,
 * el 8, el 9… Lotes enteros. Un móvil que cambia de aplicación o pierde cobertura un segundo
 * basta.
 *
 * Tres cosas cambian por eso:
 *
 * 1. Los eventos se quedan en la cola hasta que el servidor confirma. Si falla, siguen ahí y se
 *    reintentan en el siguiente vaciado.
 * 2. La cola se guarda en `sessionStorage`, así que sobrevive a una recarga: lo que no se pudo
 *    mandar antes de recargar se manda después.
 * 3. Se usa `fetch` con `keepalive` en vez de `sendBeacon`. `sendBeacon` también sobrevive al
 *    cierre, pero devuelve un booleano que solo dice «lo he encolado», nunca si llegó, y sin esa
 *    respuesta no hay nada que reintentar. `keepalive` sobrevive igual y sí contesta.
 *
 * Reintentar puede duplicar un evento (la petición llegó, la respuesta se perdió). Es el lado
 * barato del intercambio: el exportador descarta repetidos por (sesión, seq, nombre, instante), y
 * contar algo dos veces se arregla al analizar mientras que perderlo no se arregla nunca.
 */

export type Primitive = string | number | boolean | null;

export type TelemetryEventName =
  | "session_start"
  | "transform_submit"
  | "detail_mode_change"
  | "view_change"
  | "suggested_question_click"
  | "typed_question_submit"
  | "source_open"
  | "source_close"
  | "session_end";

interface RawEvent {
  session_id: string;
  participant: string | null;
  name: TelemetryEventName;
  ts: string;
  seq: number;
  data: Record<string, Primitive>;
}

const SESSION_KEY = "mmp_session_id";
const SEQ_KEY = "mmp_seq";
const PARTICIPANT_KEY = "mmp_participant";
const PENDIENTES_KEY = "mmp_pendientes";
const ENDPOINT = "/api/telemetry";
const FLUSH_INTERVAL_MS = 5000;
/** Tamaño del lote: también el umbral que dispara un envío sin esperar al reloj. */
const MAX_LOTE = 50;
/**
 * Tope de la cola sin confirmar. Una sesión real ronda los 30 eventos, así que llegar aquí
 * significa que el servidor lleva mucho rato sin aceptar nada. Se sueltan los más viejos antes
 * que dejar crecer `sessionStorage` sin fin.
 */
const MAX_PENDIENTES = 200;

let sessionId: string | null = null;
let participant: string | null = null;
let seq = 0;
let buffer: RawEvent[] = [];
let enVuelo = false;
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

function inBrowser(): boolean {
  return typeof window !== "undefined";
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** El facilitador puede fijar la etiqueta del participante por URL (`?p=P03`), sin login. */
function readParticipant(): string | null {
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("p");
    if (fromUrl) {
      const label = fromUrl.slice(0, 32);
      sessionStorage.setItem(PARTICIPANT_KEY, label);
      return label;
    }
    return sessionStorage.getItem(PARTICIPANT_KEY);
  } catch {
    return null;
  }
}

/**
 * Id de sesión: se genera una vez y vive en `sessionStorage` → sobrevive recargas de la misma
 * pestaña y muere al cerrarla (dura lo que dura la prueba). En modo privado o si el storage
 * falla, cae a un id efímero en memoria (la sesión sigue midiéndose, solo no sobrevive recarga).
 */
function ensureSession(): string {
  if (sessionId) return sessionId;
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    sessionId = id;
    // El contador vive junto al id, y por la MISMA razón: el id sobrevive a una recarga, así que
    // si `seq` volviera a 0 la sesión tendría dos eventos con seq 0, dos con seq 1… y el orden
    // dentro de la sesión dejaría de ser inequívoco, justo lo que el contrato del backend pide
    // de este campo ("contador monótono por sesión"). Pasa de verdad: una recarga en medio de la
    // prueba basta, y el análisis ordena por `seq`.
    seq = Number.parseInt(sessionStorage.getItem(SEQ_KEY) ?? "0", 10) || 0;
  } catch {
    sessionId = randomId();
  }
  return sessionId;
}

/** Deja la cola a salvo de una recarga. Lo que no se guarda aquí, se pierde al recargar. */
function persistir(): void {
  try {
    if (buffer.length === 0) sessionStorage.removeItem(PENDIENTES_KEY);
    else sessionStorage.setItem(PENDIENTES_KEY, JSON.stringify(buffer));
  } catch {
    // Sin storage la cola vive solo en memoria: se sigue reintentando mientras dure la página.
  }
}

/** Recupera lo que quedó sin confirmar antes de la última recarga, delante de lo nuevo. */
function recuperarPendientes(): void {
  try {
    const crudo = sessionStorage.getItem(PENDIENTES_KEY);
    if (!crudo) return;
    const guardados: unknown = JSON.parse(crudo);
    if (Array.isArray(guardados)) buffer = [...(guardados as RawEvent[]), ...buffer];
  } catch {
    // Un JSON a medio escribir no puede impedir que la sesión nueva se mida.
  }
}

/** Arranca la sesión de telemetría (idempotente). Se llama una vez al montar la página. */
export function initTelemetry(): void {
  if (!inBrowser() || started) return;
  started = true;
  ensureSession();
  participant = readParticipant();
  // Antes del primer evento: lo que quedó colgando de la carga anterior va primero en la cola.
  recuperarPendientes();
  track("session_start");
  timer = setInterval(() => flush(), FLUSH_INTERVAL_MS);
  // Al ocultarse/cerrarse la pestaña, vacía el buffer (`keepalive` sobrevive al unload).
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}

/** Registra un evento (lo encola). Fire-and-forget: nunca lanza. */
export function track(name: TelemetryEventName, data: Record<string, Primitive> = {}): void {
  if (!inBrowser()) return;
  const id = ensureSession();
  buffer.push({ session_id: id, participant, name, ts: new Date().toISOString(), seq: seq++, data });
  if (buffer.length > MAX_PENDIENTES) buffer = buffer.slice(-MAX_PENDIENTES);
  try {
    sessionStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    // Sin storage el contador sigue en memoria: la sesión se mide igual, solo no cruza recargas.
  }
  persistir();
  if (buffer.length >= MAX_LOTE) flush();
}

/** Saca de la cola los eventos que el servidor dio por buenos. */
function confirmar(lote: RawEvent[]): void {
  const entregados = new Set(lote.map((e) => `${e.session_id}|${e.seq}|${e.ts}`));
  buffer = buffer.filter((e) => !entregados.has(`${e.session_id}|${e.seq}|${e.ts}`));
  persistir();
}

/**
 * Envía un lote. Los eventos NO salen de la cola hasta que el servidor confirma.
 *
 * `forzar` manda aunque haya otro envío en curso: lo usan `pagehide` y la pestaña al ocultarse,
 * donde puede no haber otra oportunidad. Puede duplicar, y duplicar es barato, el exportador
 * descarta repetidos y perder un evento no se arregla luego.
 */
export function flush(forzar = false): void {
  if (!inBrowser() || buffer.length === 0) return;
  if (enVuelo && !forzar) return;

  const lote = buffer.slice(0, MAX_LOTE);
  const body = JSON.stringify({ events: lote });

  let peticion: Promise<Response>;
  try {
    peticion = fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // keepalive: la petición sobrevive a la navegación y al cierre de la pestaña.
      body,
      keepalive: true,
    });
  } catch {
    // Navegador sin `fetch` utilizable: queda `sendBeacon`, que no confirma nada. Se da por
    // entregado porque no hay forma de saberlo, es exactamente lo que hacía la versión anterior,
    // y aquí es el último recurso y no el camino normal.
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon?.(ENDPOINT, blob)) confirmar(lote);
    } catch {
      // Sin vía de salida: los eventos se quedan en la cola para el siguiente intento.
    }
    return;
  }

  enVuelo = true;
  peticion
    .then((res) => {
      // 4xx que no son de reintento (422 por un lote que el backend nunca va a aceptar, por
      // ejemplo) se dan por cerrados: insistir los dejaría atascados delante de todo lo demás.
      const definitivo = res.status >= 400 && res.status < 500 && ![408, 429].includes(res.status);
      if (res.ok || definitivo) confirmar(lote);
    })
    .catch(() => {
      // Red caída o pestaña muriendo: se quedan en la cola, y esa cola está persistida.
    })
    .finally(() => {
      enVuelo = false;
    });
}

/** Solo para tests: reinicia el estado del módulo singleton. */
export function __resetForTest(): void {
  sessionId = null;
  participant = null;
  seq = 0;
  buffer = [];
  enVuelo = false;
  started = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
