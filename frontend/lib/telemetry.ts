/**
 * Telemetría de comportamiento (Hito 8, Parte A) — capa observacional del frontend.
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
 */

export type Primitive = string | number | boolean | null;

export type TelemetryEventName =
  | "session_start"
  | "transform_submit"
  | "detail_mode_change"
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
const ENDPOINT = "/api/telemetry";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER = 50;

let sessionId: string | null = null;
let participant: string | null = null;
let seq = 0;
let buffer: RawEvent[] = [];
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

/** El facilitador puede fijar la etiqueta del participante por URL (`?p=P03`) — sin login. */
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
    // dentro de la sesión dejaría de ser inequívoco — justo lo que el contrato del backend pide
    // de este campo ("contador monótono por sesión"). Pasa de verdad: una recarga en medio de la
    // prueba basta, y el análisis ordena por `seq`.
    seq = Number.parseInt(sessionStorage.getItem(SEQ_KEY) ?? "0", 10) || 0;
  } catch {
    sessionId = randomId();
  }
  return sessionId;
}

/** Arranca la sesión de telemetría (idempotente). Se llama una vez al montar la página. */
export function initTelemetry(): void {
  if (!inBrowser() || started) return;
  started = true;
  ensureSession();
  participant = readParticipant();
  track("session_start");
  timer = setInterval(flush, FLUSH_INTERVAL_MS);
  // Al ocultarse/cerrarse la pestaña, vacía el buffer (sendBeacon sobrevive al unload).
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** Registra un evento (lo encola). Fire-and-forget: nunca lanza. */
export function track(name: TelemetryEventName, data: Record<string, Primitive> = {}): void {
  if (!inBrowser()) return;
  const id = ensureSession();
  buffer.push({ session_id: id, participant, name, ts: new Date().toISOString(), seq: seq++, data });
  try {
    sessionStorage.setItem(SEQ_KEY, String(seq));
  } catch {
    // Sin storage el contador sigue en memoria: la sesión se mide igual, solo no cruza recargas.
  }
  if (buffer.length >= MAX_BUFFER) flush();
}

/** Envía el buffer al backend y lo limpia. sendBeacon primero; fetch keepalive como respaldo. */
export function flush(): void {
  if (!inBrowser() || buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  const body = JSON.stringify({ events });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  } catch {
    // sendBeacon no disponible o rechazó → cae a fetch.
  }
  // keepalive: la petición sobrevive a la navegación en navegadores modernos.
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // La telemetría no debe afectar al usuario: se descarta en silencio.
  });
}

/** Solo para tests: reinicia el estado del módulo singleton. */
export function __resetForTest(): void {
  sessionId = null;
  participant = null;
  seq = 0;
  buffer = [];
  started = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
