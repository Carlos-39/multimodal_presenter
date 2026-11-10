/**
 * El contrato del «making of».
 *
 * Un capítulo no es markdown suelto: es una lista de bloques tipados. Lo que no se puede
 * representar no se puede escribir mal: no existe una tabla sin cabeceras, ni una figura sin su
 * explicación, ni un hallazgo que sea otra cosa que una frase. El índice se deriva de aquí en vez
 * de mantenerse a mano, así que no puede quedarse atrás del contenido.
 *
 * TypeScript y no MDX: MDX pediría una dependencia nueva y dejaría el contenido fuera del sistema
 * de tipos.
 */

export type Acto = "idea" | "fuente" | "trazabilidad" | "generado" | "aplicacion";

export const ACTOS: Record<Acto, string> = {
  idea: "La idea",
  fuente: "De la fuente a la presentación",
  trazabilidad: "Volver a la fuente",
  generado: "Lo que se genera aparte",
  aplicacion: "La aplicación alrededor",
};

/**
 * Las figuras son dibujos propios, no capturas: ilustran un concepto.
 *
 * Usan los mismos tokens de color que la interfaz, así que siguen al tema claro y oscuro sin dos
 * versiones y no envejecen cuando la interfaz cambia.
 */
export type FiguraId =
  | "pipeline-audio"
  | "hueco-contrato"
  | "aplanar"
  | "escalera-fidelidad"
  | "isomorfismo"
  | "cache-chat"
  | "equilibrio"
  | "troceo"
  | "umbrales"
  | "un-solo-sitio";

export type Bloque =
  | { tipo: "prosa"; texto: string }
  | { tipo: "encabezado"; texto: string }
  | { tipo: "tabla"; cabeceras: string[]; filas: string[][]; nota?: string }
  | { tipo: "figura"; figura: FiguraId; pie: string }
  | { tipo: "cita"; texto: string }
  /**
   * Un hallazgo es la frase que el capítulo existe para poder decir. Es un tipo propio y no prosa
   * resaltada porque se compone distinto.
   */
  | { tipo: "hallazgo"; texto: string };

export interface Capitulo {
  slug: string;
  numero: number;
  acto: Acto;
  titulo: string;
  /** La etapa del desarrollo a la que pertenece, con el mismo nombre que en el documento. */
  etapa: string;
  /**
   * La conclusión en una línea. El índice es la versión corta del making of: quien lea solo las
   * conclusiones ya se lleva la idea de cada capítulo.
   */
  conclusion: string;
  /** Vacío mientras el capítulo esté por escribir: el índice lo dice en vez de fingirlo. */
  bloques: Bloque[];
}

/**
 * Trozos en que se parte una línea de prosa para componerla.
 *
 * `marca` es el resaltador: en la aplicación señala el rastro de verificación (la cita al pie de
 * una sección, el pasaje marcado en el documento). Aquí señala lo mismo: una cifra que se
 * midió. El lector aprende el vocabulario visual de la aplicación leyendo su historia.
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

/**
 * Una celda es un dato cuando lo que trae son cifras: enteros, decimales, porcentajes, o
 * proporciones del tipo `3/3`. Lo demás es prosa.
 */
const SOLO_CIFRAS = /^[\d.,%\s/+·–-]+$/;

/**
 * Qué columnas de una tabla son de datos, mirando lo que hay dentro y no en qué posición están.
 *
 * Los números van en mono tabular: es la señal que dice que algo es un dato, y alinea las
 * columnas. Decidirlo por posición (primera columna etiqueta, el resto números) compondría en
 * monoespaciada y alineadas a la derecha las columnas de prosa.
 *
 * Una columna es de datos solo si todas sus celdas no vacías lo son: basta una celda de prosa
 * para que la columna entera se componga como prosa. Mezclar las dos cosas en una columna sería
 * peor que no distinguirlas.
 */
export function columnasDeDatos(filas: string[][], cuantas: number): boolean[] {
  return Array.from({ length: cuantas }, (_, c) => {
    const celdas = filas.map((f) => f[c] ?? "").filter((v) => v.trim() !== "");
    return celdas.length > 0 && celdas.every((v) => SOLO_CIFRAS.test(v));
  });
}

/** Si un capítulo está escrito, para que el índice no prometa lo que no hay. */
export function escrito(capitulo: Capitulo): boolean {
  return capitulo.bloques.length > 0;
}
