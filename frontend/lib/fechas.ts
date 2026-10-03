/**
 * Cuándo pasó algo, escrito como lo diría una persona.
 *
 * En una biblioteca, «hace 2 horas» sitúa y «3/10/2026» obliga a calcular. Pero solo mientras el
 * recuerdo sirva: pasada una semana, «hace 23 días» ya no dice nada que no diga mejor la fecha.
 * Por eso cambia de forma en vez de insistir con la relativa.
 *
 * Todo el formato sale de `Intl`, que ya sabe que en español se dice «ayer» y no «hace 1 día».
 */

const RELATIVO = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const ABSOLUTO = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** A partir de aquí la fecha dice más que la distancia. */
const LIMITE_RELATIVO = 7 * DIA;

/**
 * `ahora` es un parámetro para poder fijar el presente en los tests: una función que lee el reloj
 * por dentro solo se puede probar aproximando, y entonces el test mide el reloj y no el formato.
 */
export function fechaRelativa(iso: string, ahora: Date = new Date()): string {
  const momento = new Date(iso);
  if (Number.isNaN(momento.getTime())) return "";

  // Negativo = en el futuro. Pasa con el reloj del servidor ligeramente adelantado, y «dentro de
  // 3 segundos» para algo que acaba de guardarse sería desconcertante.
  const transcurrido = Math.max(0, ahora.getTime() - momento.getTime());

  if (transcurrido < MINUTO) return "hace un momento";
  if (transcurrido < HORA) return RELATIVO.format(-Math.floor(transcurrido / MINUTO), "minute");
  if (transcurrido < DIA) return RELATIVO.format(-Math.floor(transcurrido / HORA), "hour");
  if (transcurrido < LIMITE_RELATIVO) return RELATIVO.format(-Math.floor(transcurrido / DIA), "day");
  return ABSOLUTO.format(momento);
}
