import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Voz del DOCUMENTO (títulos, cuerpo de secciones, slides, citas, panel de fuente).
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
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
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
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
