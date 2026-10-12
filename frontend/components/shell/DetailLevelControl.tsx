"use client";

import type { DetailLevel } from "@/lib/detail";
import { Segmented } from "./Segmented";

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
  return <Segmented label="Nivel de detalle" options={OPTIONS} value={level} onChange={onChange} />;
}
