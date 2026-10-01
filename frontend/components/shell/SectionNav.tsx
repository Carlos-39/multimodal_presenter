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
  satellite: "detalle",
};

export function SectionNav({
  sections,
  activeSectionId,
  onSelectSection,
}: SectionNavProps) {
  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label="Secciones">
      <h2 className="px-2 pb-2 text-[0.8125rem] font-medium text-foreground">
        Secciones
      </h2>

      {sections.length === 0 ? (
        <p className="px-2 text-xs leading-5 text-muted">
          Aún no hay contenido. Transforma un texto para empezar.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {sections.map((section, i) => {
            const active = section.id === activeSectionId;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => onSelectSection(section.id)}
                  aria-current={active ? "true" : undefined}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-[0.8125rem] leading-5 transition-colors ${
                    active
                      ? "bg-accent-subtle font-medium text-accent"
                      : "text-foreground-secondary hover:bg-surface-sunken hover:text-foreground"
                  }`}
                >
                  <span className="block truncate">
                    {section.title ?? `Sección ${i + 1}`}
                  </span>
                  <span className={`text-xs font-normal ${active ? "text-accent" : "text-muted"}`}>
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
