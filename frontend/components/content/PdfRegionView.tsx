"use client";

import { useEffect, useState } from "react";
import { pdfPageImage } from "@/lib/pdfPage";
import type { CitedRegion } from "@/lib/types";

/**
 * Visor de la página citada con la cita RECUADRADA (fidelidad de región).
 *
 * Sube el PDF de "te llevo a la página 7" a "está aquí". Es el cuarto nivel del mismo esquema
 * honesto que ya usan el texto (resaltado exacto por offsets) y el audio (momento de la cita),
 * y usa deliberadamente el MISMO amarillo del resaltado de texto: para quien lo usa es la misma
 * promesa, solo que sobre una página en vez de sobre un párrafo.
 *
 * La página la dibuja el backend, con el mismo motor que midió los recuadros. Con un motor que
 * dibuja y otro que mide, cualquier desacuerdo sobre el recorte o la rotación saldría como un
 * recuadro descuadrado: y el recuadro es lo único que esta pieza promete.
 *
 * Si la imagen no se puede traer, se cae al `fallback` (el visor de siempre, fidelidad de
 * página). Nunca se queda en un error: lo que ya funcionaba sigue funcionando.
 */
export function PdfRegionView({
  file,
  region,
  fallback,
}: {
  file: File;
  region: CitedRegion;
  fallback: React.ReactNode;
}) {
  // La página sale de la REGIÓN, no de la cita: si el modelo erró el número y la frase estaba en
  // una vecina, los recuadros son de esa otra página y hay que dibujar esa. Que viajen juntos es
  // lo que impide pintar los recuadros sobre la página equivocada.
  const page = region.page;
  const [src, setSrc] = useState<string | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");

  // No se reinicia el estado aquí a mano: el panel REMONTA su contenido al cambiar de fuente
  // (`key={sourceKey}` en `SourcePanel`), así que cada cita entra con el estado ya limpio. Es el
  // mismo mecanismo que hace que el <iframe> del PDF navegue a la página correcta.
  useEffect(() => {
    let vigente = true;
    pdfPageImage(file, page)
      .then((url) => {
        if (!vigente) return;
        setSrc(url);
        setEstado("listo");
      })
      .catch(() => {
        if (vigente) setEstado("error");
      });
    // La URL NO se revoca aquí: la imagen está memorizada por documento y página, así que
    // reabrir la misma fuente la reusa. Se suelta al cargar otro documento (`olvidarPaginas`).
    return () => {
      vigente = false;
    };
  }, [file, page]);

  if (estado === "error") return <>{fallback}</>;

  const aproximada = region.quality === "approximate";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs">
        <span className="min-w-0 truncate text-muted">
          Referencia: página <span className="tabular">{page}</span>
        </span>
        {aproximada ? (
          // Se dice en la cara que es aproximada. Presentar como exacta una ubicación que no lo
          // es sería la misma sobre-afirmación que eliminó el Hito 8A.1.
          <span className="shrink-0 text-warning">Ubicación aproximada</span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {estado === "cargando" || !src ? (
          <div className="h-full min-h-40 animate-pulse rounded-md bg-surface-sunken" />
        ) : (
          <figure className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Página ${page} del documento, con la cita recuadrada`}
              className="w-full rounded-md border border-border"
            />
            {region.boxes.map((caja, i) => (
              <span
                key={i}
                aria-hidden
                className={`absolute rounded-[2px] bg-highlight/45 ${
                  aproximada
                    ? "outline-dashed outline-2 outline-warning"
                    : "outline outline-2 outline-accent"
                }`}
                style={{
                  left: `${caja.x0 * 100}%`,
                  top: `${caja.y0 * 100}%`,
                  width: `${(caja.x1 - caja.x0) * 100}%`,
                  height: `${(caja.y1 - caja.y0) * 100}%`,
                  // El aire alrededor se da con el desplazamiento del contorno, no agrandando la
                  // caja: así el recuadro sigue cayendo EXACTAMENTE donde se midió. Ensanchar las
                  // coordenadas para que "se vea mejor" sería señalar un sitio que no es el medido.
                  outlineOffset: "2px",
                }}
              />
            ))}
          </figure>
        )}
      </div>
    </div>
  );
}
