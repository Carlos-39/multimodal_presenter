"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { DetailLevel } from "@/lib/detail";
import type { NarrationStatus } from "@/hooks/useNarration";
import type { GroundingReport, Section } from "@/lib/types";
import { GroundingIndicator } from "@/components/GroundingIndicator";
import { BarraInferior, type DestinoMovil } from "./BarraInferior";
import { Hoja } from "./Hoja";
import { SectionNav } from "./SectionNav";
import { DetailLevelControl } from "./DetailLevelControl";
import { GeneratePanel } from "./GeneratePanel";
import { Interruptor } from "./Interruptor";
import { Segmented } from "./Segmented";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Núcleo estructural fijo (Stable Core Pattern, Punto 8).
 *
 * El marco (header y rail de navegación/controles) NO cambia según el contenido generado.
 * Lo dinámico es `children` (contenido + columnas opcionales, que gestiona `Workspace`).
 *
 * Dos familias de controles, separadas a propósito para que no se confundan:
 * - VER (header): cómo se muestra el contenido YA generado ( Documento | Slides y Resumen |
 *   Detallado. No generan nada.
 * - GENERAR (rail, `GeneratePanel`): piezas NUEVAS a partir del documento ) presentación y
 *   narración.
 *
 * Cambio consciente en el Hito 5e: el chat dejó de ser un rail SIEMPRE presente (como en el
 * Hito 3) y pasó a ser una COLUMNA OPCIONAL de la Escala 2 (`Workspace`), gobernada desde este
 * header por un toggle. El nav sí sigue fijo: nunca compite por espacio.
 */
interface AppShellProps {
  sections: Section[];
  grounding: GroundingReport | null;
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
  detailLevel: DetailLevel;
  onDetailLevelChange: (level: DetailLevel) => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  slidesOpen: boolean;
  slidesAvailable: boolean;
  onToggleSlides: () => void;
  deckOpen: boolean;
  /**
   * Controles que no pertenecen a la vista del documento (hoy: guardar y la cuenta).
   *
   * Es un hueco y no props concretas porque el armazón no tiene por qué saber que existen las
   * cuentas. Y van AQUÍ, dentro de la fila de controles, no flotando encima: un botón `fixed`
   * queda fuera de este `flex`, nada le reserva sitio y en ventanas estrechas se monta sobre el
   * de al lado. Pasó con «Entrar» sobre «Chat».
   */
  acciones?: ReactNode;
  deckReady: boolean; // la presentación ya se generó
  deckAvailable: boolean;
  deckLoading: boolean;
  deckError: boolean;
  onToggleDeck: () => void;
  narrationStatus: NarrationStatus;
  narrationAvailable: boolean;
  onNarrationPlay: () => void;
  onNarrationPause: () => void;
  onNarrationStop: () => void;
  narrationCurrentTime: number;
  narrationDuration: number;
  onNarrationSeek: (segundos: number) => void;
  onNarrationSkip: (delta: number) => void;
  children: React.ReactNode;
}

type ViewMode = "document" | "slides";

export function AppShell({
  sections,
  grounding,
  activeSectionId,
  onSelectSection,
  detailLevel,
  onDetailLevelChange,
  chatOpen,
  onToggleChat,
  slidesOpen,
  slidesAvailable,
  onToggleSlides,
  deckOpen,
  acciones,
  deckReady,
  deckAvailable,
  deckLoading,
  deckError,
  onToggleDeck,
  narrationStatus,
  narrationAvailable,
  onNarrationPlay,
  onNarrationPause,
  onNarrationStop,
  narrationCurrentTime,
  narrationDuration,
  onNarrationSeek,
  onNarrationSkip,
  children,
}: AppShellProps) {
  // Con la presentación generada abierta no hay vista "Documento | Slides" seleccionada.
  const viewMode: ViewMode | null = deckOpen ? null : slidesOpen ? "slides" : "document";

  // Se apoya en los manejadores existentes (cada uno ya cierra la otra vista).
  function handleViewChange(next: ViewMode) {
    if (next === "slides") {
      if (!slidesOpen) onToggleSlides();
    } else if (slidesOpen) {
      onToggleSlides();
    } else if (deckOpen) {
      onToggleDeck();
    }
  }

  /**
   * Qué hoja está abierta en pantalla estrecha. Vive aquí y no en cada hoja porque solo puede
   * haber una: dos hojas superpuestas serían dos maneras de salir y ninguna evidente.
   *
   * El chat NO entra en este estado: ya lo gobierna `Workspace`, que por debajo de 1024 px lo
   * muestra como superposición. Duplicarlo aquí daría dos fuentes de verdad para lo mismo.
   */
  const [hoja, setHoja] = useState<Exclude<DestinoMovil, "chat"> | null>(null);

  function irA(destino: DestinoMovil) {
    if (destino === "chat") {
      setHoja(null);
      onToggleChat();
      return;
    }
    setHoja((actual) => (actual === destino ? null : destino));
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Header fijo.
          Hasta `lg` son DOS filas y no una envuelta: arriba quién eres y qué puedes hacer con tu
          cuenta, abajo los dos controles de VER. Dejarlo al `flex-wrap` repartía los controles en
          tres o cuatro renglones distintos cada vez que cambiaba una etiqueta, y un marco que se
          recoloca solo es un marco que no se aprende.
          El corte es `lg` y no `sm` por lo mismo: con `sm` el teléfono bajaba los controles de VER
          y la tableta bajaba los de la cuenta, la misma cabecera plegándose de dos maneras
          distintas según la anchura. Ahora se pliega igual en todo el camino, y solo se estira
          cuando de verdad cabe entera. */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-4 py-2.5 lg:justify-between">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {/* El nombre lleva a la portada. Es el sitio convencional y descubrible para volver al
              inicio, y es un enlace de verdad: funciona con el teclado, con el botón central y
              con «abrir en pestaña nueva». Va a `/inicio` y no a `/`, porque `/` es la puerta que
              con la cookie puesta devuelve aquí mismo. */}
          <Link
            href="/inicio"
            title="Volver a la portada"
            className="truncate rounded-sm text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-accent"
          >
            Multimodal Presenter
          </Link>
          <span className="hidden text-xs text-muted xl:inline">prototipo</span>
        </div>
        {/* En móvil esta fila baja entera (`basis-full`) y queda debajo de la marca; en cuanto hay
            sitio vuelve a su lugar. Los dos controles de VER se quedan en la cabecera y no se
            esconden en un menú por un motivo que no es estético: `view_change` y
            `detail_mode_change` son los eventos que mide el Hito 8. Enterrarlos cambiaría lo que
            significa la medición: pasaría a medir cuánto cuesta encontrar el botón. */}
        <div className="order-3 flex basis-full flex-wrap items-center justify-end gap-x-3 gap-y-2 lg:order-2 lg:basis-auto">
          <GroundingIndicator grounding={grounding} />
          {/* `flex-wrap`: en una pantalla de 320 px los dos controles juntos miden más que la
              fila, y sin esto no se encogían: se comían el margen derecho hasta pegarse al
              borde. Partirse en dos renglones es lo correcto: son dos preguntas distintas (cómo
              se ve y cuánto detalle), no una sola barra que haya que mantener entera. */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-border lg:flex-nowrap lg:border-l lg:pl-3">
            <span className="hidden text-xs text-muted xl:inline">Ver</span>
            <Segmented<ViewMode>
              label="Vista del contenido"
              value={viewMode}
              onChange={handleViewChange}
              options={[
                { value: "document", label: "Documento" },
                { value: "slides", label: "Slides", disabled: !slidesAvailable },
              ]}
            />
            <DetailLevelControl level={detailLevel} onChange={onDetailLevelChange} />
          </div>
        </div>

        {/* El tema y la cuenta se quedan arriba, al lado del nombre: en móvil son lo que uno busca
            «en la esquina», y no tienen nada que ver con leer el documento.

            El atajo a la presentación que vivía aquí para pantallas angostas desaparece, y no es
            una pérdida: ahora la presentación está en la hoja de «Generar», al lado de la
            narración, que es donde siempre debió estar. Era un parche que tapaba la mitad del
            agujero: la narración seguía sin existir en el móvil. */}
        <div className="order-2 flex items-center justify-end gap-2 lg:order-3 lg:border-l lg:border-border lg:pl-3">
          {/* El chat no es una acción que pasa y se acaba: es un estado que se queda. Un
              rectángulo que cambia de color obliga a recordar qué color era «abierto».
              En móvil vive en la barra de abajo, con los otros dos destinos. */}
          <span className="hidden md:inline">
            <Interruptor label="Chat" checked={chatOpen} onChange={onToggleChat} />
          </span>
          <ThemeToggle />
          {acciones}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Rail izquierdo fijo: navegación + lo que se puede generar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <SectionNav
            sections={sections}
            activeSectionId={activeSectionId}
            onSelectSection={onSelectSection}
          />
          <div className="shrink-0 border-t border-border">
            <GeneratePanel
              deckOpen={deckOpen}
              deckReady={deckReady}
              deckAvailable={deckAvailable}
              deckLoading={deckLoading}
              deckError={deckError}
              onToggleDeck={onToggleDeck}
              narrationStatus={narrationStatus}
              narrationAvailable={narrationAvailable}
              onNarrationPlay={onNarrationPlay}
              onNarrationPause={onNarrationPause}
              onNarrationStop={onNarrationStop}
              narrationCurrentTime={narrationCurrentTime}
              narrationDuration={narrationDuration}
              onNarrationSeek={onNarrationSeek}
              onNarrationSkip={onNarrationSkip}
            />
          </div>
        </aside>

        {/* Zona dinámica: contenido + columnas opcionales (Workspace, Escala 2 del Hito 5e).
            El foco vive AQUÍ y no en el armazón entero: el rail y la cabecera son el marco, y un
            marco no se ilumina. */}
        <main className="foco min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Lo mismo que el carril, con otra forma, para cuando no hay anchura para un carril.
          Las dos hojas sirven EL MISMO componente que la columna de escritorio: si algún día
          cambia la navegación o lo que se puede generar, cambia en los dos sitios a la vez
          porque es el mismo sitio. */}
      <BarraInferior activo={chatOpen ? "chat" : hoja} onIr={irA} secciones={sections.length} />

      <Hoja abierta={hoja === "secciones"} onCerrar={() => setHoja(null)} titulo="Secciones">
        <SectionNav
          titulado={false}
          sections={sections}
          activeSectionId={activeSectionId}
          onSelectSection={(id) => {
            onSelectSection(id);
            // Elegir una sección cierra la hoja: lo que se quería era llegar a ella, y dejarla
            // abierta obligaría a un gesto más para ver aquello a lo que se acaba de saltar.
            setHoja(null);
          }}
        />
      </Hoja>

      <Hoja abierta={hoja === "generar"} onCerrar={() => setHoja(null)} titulo="Generar">
        <GeneratePanel
          titulado={false}
          deckOpen={deckOpen}
          deckReady={deckReady}
          deckAvailable={deckAvailable}
          deckLoading={deckLoading}
          deckError={deckError}
          onToggleDeck={() => {
            onToggleDeck();
            setHoja(null);
          }}
          narrationStatus={narrationStatus}
          narrationAvailable={narrationAvailable}
          onNarrationPlay={onNarrationPlay}
          onNarrationPause={onNarrationPause}
          onNarrationStop={onNarrationStop}
          narrationCurrentTime={narrationCurrentTime}
          narrationDuration={narrationDuration}
          onNarrationSeek={onNarrationSeek}
          onNarrationSkip={onNarrationSkip}
        />
      </Hoja>
    </div>
  );
}
