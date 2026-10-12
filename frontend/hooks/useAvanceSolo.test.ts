import { describe, expect, it } from "vitest";
import { enRango } from "./useAvanceSolo";

/**
 * El recorrido de la portada lo comparten tres piezas con distinto número de pasos, y la única
 * parte que puede fallar en silencio es dar la vuelta: `%` en JavaScript conserva el signo.
 */
describe("enRango", () => {
  it("deja en paz lo que ya está dentro", () => {
    expect(enRango(0, 6)).toBe(0);
    expect(enRango(3, 6)).toBe(3);
    expect(enRango(5, 6)).toBe(5);
  });

  it("da la vuelta por arriba", () => {
    expect(enRango(6, 6)).toBe(0);
    expect(enRango(7, 6)).toBe(1);
    expect(enRango(13, 6)).toBe(1);
  });

  it("da la vuelta por abajo, que es donde fallaba la fórmula anterior", () => {
    // Un paso por debajo: es lo que hace el botón «Anterior» del carrusel en el primer punto.
    expect(enRango(-1, 6)).toBe(5);
    // Más de una vuelta por debajo: `(i + total) % total` habría devuelto -1 aquí.
    expect(enRango(-7, 6)).toBe(5);
    expect(enRango(-13, 6)).toBe(5);
  });

  it("vale para los tres tamaños que hay en la portada", () => {
    // El interruptor del problema: dos pasos.
    expect(enRango(-1, 2)).toBe(1);
    expect(enRango(2, 2)).toBe(0);
    // El recorrido del héroe: tres entradas por dos secciones.
    expect(enRango(-1, 6)).toBe(5);
    // El carrusel: seis capacidades.
    expect(enRango(6, 6)).toBe(0);
  });
});
