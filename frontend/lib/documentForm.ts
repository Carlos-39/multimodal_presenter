/**
 * Punto ÚNICO por el que se manda el documento al backend.
 *
 * Existe por lo mismo que `parse_document_inputs` del lado del servidor: el documento entra a
 * cada petición por un solo sitio, así que añadir una forma nueva de referirse a él se hace una
 * vez y no en siete.
 *
 * Y la forma nueva hacía falta: una presentación guardada se abre mañana desde otro navegador,
 * donde el `File` original ya no existe. En ese caso se manda el `document_id` y el backend saca
 * los bytes de su almacén, comprobando antes que quien pide es su dueño.
 */

import type { OriginalSource } from "@/hooks/useChat";

/**
 * Añade el documento al formulario: el archivo si se tiene, el texto si lo hay, y si no, el id
 * del documento guardado.
 *
 * El orden importa. Cuando hay `File` se manda el archivo aunque también haya id: es el mismo
 * documento (el id es un hash de sus bytes) y evita un viaje al almacén por algo que ya está en
 * memoria del navegador.
 */
export function anexaDocumento(form: FormData, original: OriginalSource): void {
  if (original.text) form.append("text", original.text);
  if (original.file) {
    form.append("file", original.file);
    return;
  }
  if (!original.text && original.documentId) form.append("document_id", original.documentId);
}

/**
 * URL desde la que leer los bytes del documento, o `null` si no hay forma.
 *
 * Con `File` se crea un object URL como siempre; con una presentación restaurada se apunta al
 * endpoint de la biblioteca. El panel de fuente necesita esto: sin el documento, lo guardado se
 * podría leer pero no verificar, que es justo lo que el proyecto promete que sí se puede.
 */
export function urlDelDocumento(original: OriginalSource): { url: string; esObjeto: boolean } | null {
  if (original.file) return { url: URL.createObjectURL(original.file), esObjeto: true };
  if (original.documentId) {
    return { url: `/api/biblioteca/documentos/${original.documentId}`, esObjeto: false };
  }
  return null;
}
