"use client";

import type { DetailLevel } from "@/lib/detail";

/**
 * Selector de nivel de detalle (Punto 11): control explícito del usuario, sin detección
 * automática. Parte del núcleo fijo (Stable Core): su posición y comportamiento no cambian
 * entre presentaciones.
 */
interface DetailLevelControlProps {
  level: DetailLevel;
  onChange: (level: DetailLevel) => void;
}

const OPTIONS: { value: DetailLevel; label: string }[] = [
  { value: "summary", label: "Resumen" },
  { value: "detailed", label: "Detallado" },
];

export function DetailLevelControl({ level, onChange }: DetailLevelControlProps) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
      role="group"
      aria-label="Nivel de detalle"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === level;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
