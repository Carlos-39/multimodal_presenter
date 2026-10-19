import { describe, expect, it } from "vitest";
import { fechaRelativa, tramoDe } from "./fechas";

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

describe("tramoDe", () => {
  /*
   * Las fechas se construyen en hora LOCAL y no con cadenas en UTC a propósito.
   *
   * `tramoDe` agrupa por el día del calendario de quien mira, que es lo correcto («hoy» significa
   * hoy para ti), así que depende de la zona horaria. Escribí la primera versión de este test con
   * cadenas terminadas en `Z` y falló en una máquina en UTC−5: `2026-10-05T01:00:00Z` es el día 4
   * por la tarde aquí. El fallo era del test, no de la función.
   */
  const alas = (dia: number, hora: number) => new Date(2026, 9, dia, hora, 0).toISOString();
  const ahora = new Date(2026, 9, 5, 14, 0);

  it("hoy es el mismo día del calendario, no las últimas 24 horas", () => {
    expect(tramoDe(alas(5, 1), ahora)).toBe("hoy");
    // Tres horas antes, pero ya es otro día: va a «esta semana», no a «hoy».
    expect(tramoDe(alas(4, 23), new Date(2026, 9, 5, 2, 0))).toBe("semana");
  });

  it("la semana llega hasta el sexto día", () => {
    expect(tramoDe(alas(4, 10), ahora)).toBe("semana");
    expect(tramoDe(new Date(2026, 8, 30, 10, 0).toISOString(), ahora)).toBe("semana");
  });

  it("a partir del séptimo día, antes", () => {
    expect(tramoDe(new Date(2026, 8, 28, 10, 0).toISOString(), ahora)).toBe("antes");
    expect(tramoDe(new Date(2025, 0, 1, 10, 0).toISOString(), ahora)).toBe("antes");
  });

  it("una fecha futura cuenta como hoy, no como error", () => {
    expect(tramoDe(alas(6, 10), ahora)).toBe("hoy");
  });

  it("una fecha ilegible no revienta: cae en el último montón", () => {
    expect(tramoDe("no es una fecha", ahora)).toBe("antes");
  });
});
