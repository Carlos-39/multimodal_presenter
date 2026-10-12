/**
 * Una línea de texto insinuada, sin texto.
 *
 * Las láminas de la portada dibujan documentos y páginas con los tokens del tema en vez de usar
 * capturas: así siguen al claro y al oscuro sin dos versiones, y no envejecen cuando la interfaz
 * cambia. Esta es la pieza mínima de todas ellas, compartida para que no haya dos.
 */
export function Barra({ ancho, tono = "suave" }: { ancho: string; tono?: "suave" | "fuerte" }) {
  return (
    <span
      aria-hidden
      className={`block h-[5px] rounded-full ${tono === "fuerte" ? "bg-border-strong" : "bg-border"}`}
      style={{ width: ancho }}
    />
  );
}
