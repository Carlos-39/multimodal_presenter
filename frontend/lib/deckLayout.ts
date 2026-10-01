import type { GeneratedSlide } from "./types";

/**
 * Composición de una diapositiva de la presentación generada, decidida SOLO por lo que la slide
 * trae (regla fija: misma slide → misma composición siempre). No cambia su contenido.
 *
 * - `media`: tiene ilustración → texto a un lado, imagen al otro.
 * - `list`: tiene viñetas → título arriba y la enumeración debajo.
 * - `statement`: una idea central (o solo el título) → texto grande, centrado en vertical.
 */
export type SlideLayout = "media" | "list" | "statement";

export function slideLayout(slide: Pick<GeneratedSlide, "bullets" | "illustration">): SlideLayout {
  if (slide.illustration) return "media";
  if (slide.bullets.length > 0) return "list";
  return "statement";
}
