/**
 * Imagen de UNA página del PDF, para el visor con resaltado de región.
 *
 * La dibuja el backend, con el mismo motor que calculó los recuadros: con un motor que dibuja y
 * otro que mide, cualquier desacuerdo sobre el recorte o la rotación de la página aparecería como
 * un recuadro descuadrado, que es justo lo que esta pieza promete que no pasa.
 *
 * El archivo viaja en la petición, igual que en el chat, el deck y la narración — el backend no
 * guarda documentos. Por eso se memoriza: abrir y cerrar la misma fuente, o volver a ella desde
 * otra sección de la misma página, no vuelve a subir el PDF ni a dibujar nada.
 */

/** Promesa en vuelo o ya resuelta, por archivo y página. Se comparte entre componentes. */
const memoria = new Map<File, Map<number, Promise<string>>>();

function paraArchivo(file: File): Map<number, Promise<string>> {
  let porPagina = memoria.get(file);
  if (!porPagina) {
    porPagina = new Map();
    memoria.set(file, porPagina);
  }
  return porPagina;
}

/**
 * URL de objeto con la página dibujada. Lanza si el backend no la pudo dibujar.
 *
 * Se memoriza la PROMESA, no el resultado: si el panel se abre dos veces seguidas antes de que
 * llegue la primera imagen, la segunda espera a la misma petición en vez de lanzar otra.
 */
export function pdfPageImage(file: File, page: number): Promise<string> {
  const porPagina = paraArchivo(file);
  const yaPedida = porPagina.get(page);
  if (yaPedida) return yaPedida;

  const peticion = (async () => {
    const form = new FormData();
    form.append("file", file);
    form.append("page", String(page));
    const res = await fetch("/api/pdf-page", { method: "POST", body: form });
    if (!res.ok) throw new Error(`No se pudo dibujar la página ${page}`);
    return URL.createObjectURL(await res.blob());
  })();

  // Si falla, se olvida: así reintentar (reabrir la fuente) vuelve a pedirla en vez de quedarse
  // con el error para siempre.
  peticion.catch(() => porPagina.delete(page));
  porPagina.set(page, peticion);
  return peticion;
}

/** Suelta las imágenes de un documento. Se llama al cargar otro documento, no al cerrar el panel. */
export function olvidarPaginas(file: File | null): void {
  if (!file) return;
  const porPagina = memoria.get(file);
  if (!porPagina) return;
  for (const promesa of porPagina.values()) {
    promesa.then(URL.revokeObjectURL).catch(() => {});
  }
  memoria.delete(file);
}
