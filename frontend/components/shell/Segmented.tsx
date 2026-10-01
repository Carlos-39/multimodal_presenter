"use client";

/**
 * Control segmentado: elegir UNA entre pocas opciones excluyentes. Lo usan los dos selectores de
 * "cómo ver" el contenido (vista y nivel de detalle), para que se lean como la misma familia.
 * `value` puede no coincidir con ninguna opción (nada seleccionado).
 */
interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  label: string; // nombre accesible del grupo
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md bg-surface-sunken p-0.5"
      role="group"
      aria-label={label}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
              active
                ? "bg-surface font-medium text-foreground ring-1 ring-border"
                : "text-muted hover:text-foreground disabled:hover:text-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
