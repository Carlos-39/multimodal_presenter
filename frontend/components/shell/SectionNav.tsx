"use client";

import type { Section } from "@/lib/types";

/**
 * Navegación entre secciones (parte del núcleo fijo). Funcional en este hito: al
 * seleccionar una sección, el contenedor la desplaza a la vista y la resalta.
 */
interface SectionNavProps {
  sections: Section[];
  activeSectionId: string | null;
  onSelectSection: (id: string) => void;
}

const ROLE_LABEL: Record<Section["role"], string> = {
  core: "núcleo",
  satellite: "satélite",
};

export function SectionNav({
  sections,
  activeSectionId,
  onSelectSection,
}: SectionNavProps) {
  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label="Secciones">
      <h2 className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Secciones
      </h2>

      {sections.length === 0 ? (
        <p className="px-2 text-sm text-muted">
          Aún no hay contenido. Transforma un texto para empezar.
        </p>
      ) : (
        <ul className="space-y-1">
          {sections.map((section, i) => {
            const active = section.id === activeSectionId;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onSelectSection(section.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-background"
                  }`}
                >
                  <span className="block truncate">
                    {section.title ?? `Sección ${i + 1}`}
                  </span>
                  <span
                    className={`text-xs ${active ? "text-accent-foreground/80" : "text-muted"}`}
                  >
                    {ROLE_LABEL[section.role]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
