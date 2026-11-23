import { withBase } from '@/shared/base';
import type { NavItem } from '@/shared/navigation';

/**
 * Marcadores del brandbook de Unisimón Research (8.0, "Marcadores y set de íconos"), en
 * public/assets/brand/marcadores. Se pintan como máscara: toman el color del texto (`text-*`) y el tamaño de la
 * fuente, igual que Icon. Son para conceptos de la marca (personas, red, hallazgo, ubicación…); las acciones de
 * interfaz (buscar, cerrar, flechas) siguen con Icon, porque el set del brandbook no las cubre.
 */
export type BrandIconName =
  | 'anillo'
  | 'anillo-fino'
  | 'brillo'
  | 'foco'
  | 'halo'
  | 'halo-doble'
  | 'objetivo'
  | 'persona'
  | 'personas'
  | 'pulso'
  | 'punto'
  | 'punto-grande'
  | 'radar'
  | 'red'
  | 'ubicacion';

/** Marcador de cada módulo, según el significado que el brandbook da a cada forma. */
export const MODULE_MARKER: Record<NavItem['key'], BrandIconName> = {
  centers: 'foco', // un ámbito que concentra capacidades
  groups: 'personas', // equipo
  authors: 'persona', // investigador
  projects: 'objetivo', // meta, propósito
  products: 'halo', // hallazgo con área de influencia
  relations: 'red', // nodos conectados, colaboración
};

export function BrandIcon({ name, className = '' }: { name: BrandIconName; className?: string }) {
  const mask = `url(${withBase(`/assets/brand/marcadores/${name}.svg`)}) center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-[1em] w-[1em] shrink-0 bg-current ${className}`}
      style={{ mask, WebkitMask: mask }}
    />
  );
}
