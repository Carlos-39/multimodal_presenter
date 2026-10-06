import type { Metadata } from "next";
import { Archivo, Geist_Mono, Newsreader } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/**
 * Las dos voces del 5k siguen siendo dos, y siguen significando lo mismo: **la serifa es el
 * documento, la sans es la herramienta**. Lo que cambió son las caras, y una asignación que estaba
 * mal.
 *
 * El motivo del cambio: papel cálido con serifa para el cuerpo es, literalmente, la casa de
 * Claude. El sistema era coherente y defendible, y aterrizó en el sitio donde está todo el mundo.
 *
 * Y la asignación mal puesta: «Entiende un documento difícil» **no lo dice el documento, lo dice
 * la aplicación** — iba en serifa, o sea en la voz equivocada. Los titulares de la portada pasan a
 * la sans. Lo que viene del documento (secciones, citas, diapositivas, panel de fuente) y el
 * relato del «cómo se construyó», que es material de lectura, conservan la serifa.
 */

// Voz de la HERRAMIENTA: navegación, controles, etiquetas — y ahora también los titulares.
const archivo = Archivo({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

// Los números siguen en mono tabular: es la señal que dice «esto es un dato».
const geistMono = Geist_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
});

// Voz del DOCUMENTO (cuerpo de secciones, slides, citas, panel de fuente, capítulos).
const newsreader = Newsreader({
  variable: "--font-doc-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Multimodal Presenter",
  description:
    "Transformador de información multimodal — trabajo de grado (Univalle).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning`: el script de abajo puede fijar `data-theme` antes de hidratar.
    <html
      lang="es"
      className={`${archivo.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica el tema guardado ANTES del primer pintado (sin parpadeo claro→oscuro). */}
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
