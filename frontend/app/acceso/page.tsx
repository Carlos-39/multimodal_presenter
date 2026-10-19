import type { Metadata } from "next";
import { destinoSeguro } from "@/lib/acceso";
import { AccesoClient } from "./AccesoClient";

/**
 * `/acceso`: la única página que se ve sin haber pasado el portón.
 *
 * Tiene que quedar fuera de él por lo evidente (si no, no habría forma de pedir el código), y por
 * eso mismo no muestra nada: ni la portada, ni cuántas presentaciones hay, ni si el portón está
 * puesto siquiera. Lo único que dice es qué hace falta para entrar.
 */
export const metadata: Metadata = {
  title: "Acceso · Multimodal Presenter",
  // Que no se indexe: es una puerta, no contenido.
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const crudo = typeof parametros.destino === "string" ? parametros.destino : null;
  // Se sanea AQUÍ además de en el proxy: esta página escribe el destino en un formulario, y un
  // `//otro.sitio` convertiría el portón en un trampolín para mandar a alguien a otra parte.
  return <AccesoClient destino={destinoSeguro(crudo)} />;
}
