import type { GeneratedSlide, PapelDeSlide } from "./types";

/**
 * Composición de una diapositiva de la presentación generada.
 *
 * La decide el PAPEL que la diapositiva declara, no lo que trae dentro. Antes se deducía de los
 * campos llenos (con imagen al lado, con viñetas en lista, si no texto centrado), y de ahí venía
 * el problema que destapó la primera prueba: tres formas posibles para catorce láminas hacen que
 * una presentación se lea como el documento transformado otra vez. Una presentación de verdad
 * varía, porque sus láminas no hacen todas lo mismo.
 *
 * - `apertura` y `cierre`: una frase grande y sola, con su imagen de ambiente si la hay.
 * - `dato`: la cifra manda y el texto la glosa.
 * - `comparacion`: dos columnas con una línea en medio.
 * - `cita`: el documento hablando, en grande.
 * - `figura`: la imagen ES la diapositiva.
 * - `afirmacion`: afirma y sostiene. Lo de siempre, y el valor por defecto.
 */
export type SlideLayout =
  | "enunciado"
  | "dato"
  | "comparacion"
  | "cita"
  | "media"
  | "lista"
  | "afirmacion";

export function slideLayout(
  slide: Pick<
    GeneratedSlide,
    "bullets" | "illustration" | "papel" | "cifra" | "comparacion" | "source"
  >,
): SlideLayout {
  // Una presentación guardada antes del rediseño no trae papel. Se compone como antes, que es lo
  // que había cuando se guardó: abrir la biblioteca no debería cambiarle la cara a algo viejo.
  const papel: PapelDeSlide = slide.papel ?? "afirmacion";

  // El papel manda, pero no puede prometer lo que la diapositiva no trae. Si el modelo declara
  // `dato` y no pone cifra, o `comparacion` sin los dos lados, se cae a la composición de
  // siempre: una lámina sosa es mucho mejor que una rota.
  if (papel === "dato" && slide.cifra) return "dato";
  if (papel === "comparacion" && slide.comparacion) return "comparacion";
  if (papel === "cita" && slide.source?.quote) return "cita";
  if (papel === "apertura" || papel === "cierre") return "enunciado";
  if (papel === "figura" && slide.illustration) return "media";

  if (slide.illustration) return "media";
  if (slide.bullets.length > 0) return "lista";
  return "afirmacion";
}
