import { describe, expect, it } from "vitest";
import { fechaRelativa } from "./fechas";

const AHORA = new Date("2026-10-03T12:00:00Z");

/** Un momento `ms` milisegundos antes de `AHORA`, en ISO. */
function hace(ms: number): string {
  return new Date(AHORA.getTime() - ms).toISOString();
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

describe("fechaRelativa", () => {
  it("lo recién hecho no se cuenta en segundos", () => {
    // "hace 3 segundos" en una biblioteca es ruido: lo que importa es que acaba de pasar.
    expect(fechaRelativa(hace(3_000), AHORA)).toBe("hace un momento");
  });

  it("minutos y horas", () => {
    expect(fechaRelativa(hace(5 * MINUTO), AHORA)).toBe("hace 5 minutos");
    expect(fechaRelativa(hace(2 * HORA), AHORA)).toBe("hace 2 horas");
  });

  it("el día anterior se dice «ayer», no «hace 1 día»", () => {
    // Es `Intl` quien sabe esto; escribirlo a mano habría dado la forma rara.
    expect(fechaRelativa(hace(DIA), AHORA)).toBe("ayer");
    expect(fechaRelativa(hace(3 * DIA), AHORA)).toBe("hace 3 días");
  });

  it("pasada una semana cambia a la fecha", () => {
    // "hace 23 días" ya no sitúa a nadie; la fecha sí.
    const viejo = fechaRelativa(hace(30 * DIA), AHORA);
    expect(viejo).not.toContain("hace");
    expect(viejo).toContain("2026");
  });

  it("una fecha en el futuro no dice «dentro de»", () => {
    // Pasa con el reloj del servidor adelantado unos segundos, y sería desconcertante verlo en
    // algo que se acaba de guardar.
    const futuro = new Date(AHORA.getTime() + 5_000).toISOString();
    expect(fechaRelativa(futuro, AHORA)).toBe("hace un momento");
  });

  it("una fecha ilegible no rompe la fila", () => {
    expect(fechaRelativa("no soy una fecha", AHORA)).toBe("");
  });
});
