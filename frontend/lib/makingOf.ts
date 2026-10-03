/**
 * El contrato del «making of».
 *
 * Un capítulo no es markdown suelto: es una lista de bloques tipados. La razón es la misma que
 * cerró el hueco del Hito 1 — lo que no se puede representar no se puede escribir mal. No existe
 * una tabla sin cabeceras, ni una figura sin su explicación, ni un hallazgo que sea otra cosa que
 * una frase. El índice se deriva de aquí en vez de mantenerse a mano, así que no puede quedarse
 * atrás del contenido.
 *
 * Se eligió TypeScript y no MDX a propósito: MDX pediría una dependencia nueva y dejaría el
 * contenido fuera del sistema de tipos, que es justo lo que este proyecto no hace.
 */

export type Acto = "cimiento" | "trazabilidad" | "midiendo" | "usable" | "cierre";

export const ACTOS: Record<Acto, string> = {
  cimiento: "El cimiento",
  trazabilidad: "La promesa de trazabilidad",
  midiendo: "Lo que se descubrió midiendo",
  usable: "Hacerlo usable, y usado",
  cierre: "Cierre",
};

/** Las figuras son dibujos propios, no capturas: ilustran un concepto. */
export type FiguraId = "pipeline-audio";

export type Bloque =
  | { tipo: "prosa"; texto: string }
  | { tipo: "encabezado"; texto: string }
  | { tipo: "tabla"; cabeceras: string[]; filas: string[][]; nota?: string }
  | { tipo: "figura"; figura: FiguraId; pie: string }
  | { tipo: "cita"; texto: string }
  /**
   * Un hallazgo es la frase que el capítulo existe para poder decir. Es un tipo propio y no prosa
   * en negrita porque se compone distinto y porque tenerlo tipado permite, más adelante, reunir
   * todos los hallazgos del proyecto sin volver a leerse los capítulos.
   */
  | { tipo: "hallazgo"; texto: string };

export interface Capitulo {
  slug: string;
  numero: number;
  acto: Acto;
  titulo: string;
  /** Los hitos del Registro que cubre. Se muestra como procedencia, no como decoración. */
  hitos: string;
  /**
   * La conclusión en una línea. El índice es la versión corta del making of: quien lea solo las
   * catorce conclusiones ya se lleva la historia. Es el progressive disclosure del Punto 9
   * aplicado al propio relato.
   */
  conclusion: string;
  /** Vacío mientras el capítulo esté por escribir: el índice lo dice en vez de fingirlo. */
  bloques: Bloque[];
}

/**
 * Trozos en que se parte una línea de prosa para componerla.
 *
 * `marca` es el resaltador: en la aplicación señala el rastro de verificación (la cita al pie de
 * una sección, el pasaje marcado en el documento). Aquí señala lo mismo: **una cifra que se
 * midió**. El lector aprende el vocabulario visual de la aplicación leyendo su historia.
 */
export type Trozo =
  | { clase: "texto"; texto: string }
  | { clase: "fuerte"; texto: string }
  | { clase: "marca"; texto: string }
  | { clase: "codigo"; texto: string };

const PATRON = /(\*\*[^*]+\*\*|==[^=]+==|`[^`]+`)/g;

/**
 * Convierte una línea con marcas en trozos componibles.
 *
 * Tres marcas y ninguna más: `**fuerte**`, `==medido==` y `` `código` ``. No es un markdown a
 * medias: es un vocabulario cerrado, por lo mismo que `ChartType` es un enum y no texto libre.
 * Un markdown completo invitaría a meter en el contenido cosas que el diseño no sabe componer.
 */
export function trozos(linea: string): Trozo[] {
  const salida: Trozo[] = [];
  for (const parte of linea.split(PATRON)) {
    if (!parte) continue;
    if (parte.startsWith("**") && parte.endsWith("**")) {
      salida.push({ clase: "fuerte", texto: parte.slice(2, -2) });
    } else if (parte.startsWith("==") && parte.endsWith("==")) {
      salida.push({ clase: "marca", texto: parte.slice(2, -2) });
    } else if (parte.startsWith("`") && parte.endsWith("`")) {
      salida.push({ clase: "codigo", texto: parte.slice(1, -1) });
    } else {
      salida.push({ clase: "texto", texto: parte });
    }
  }
  return salida;
}

/** Cuántos capítulos están escritos, para que el índice no prometa lo que no hay. */
export function escrito(capitulo: Capitulo): boolean {
  return capitulo.bloques.length > 0;
}
