/**
 * Escala secuencial de un solo tono (verde) para la categoría Minciencias de un grupo:
 * A1 la más oscura y la de mayor peso; cada categoría inferior, más clara. Contraste texto/fondo
 * ≥ 5:1 en todos los pasos (WCAG AA); los pasos claros llevan borde para no perderse sobre el crema.
 */
const TONES: Record<string, string> = {
  A1: 'bg-[#164130] text-[#8CFAA1]',
  A: 'bg-[#1F5A41] text-white',
  B: 'bg-[#2F7D55] text-white',
  C: 'bg-[#A9DCC0] text-[#164130] ring-1 ring-inset ring-[#7FBF9C]',
  D: 'bg-[#D4EEDF] text-[#1F5A41] ring-1 ring-inset ring-[#9CCBB1]',
  RECONOCIDO: 'bg-[#EEF4EF] text-[#3F5E4D] ring-1 ring-inset ring-[#B9DCC8]',
};
const NONE = 'bg-surface-cream-alt text-neutral-muted ring-1 ring-inset ring-border-subtle';

/** Clases de fondo y texto para la categoría (A1, A, B, C, D, Reconocido); sin categoría, neutro. */
export const categoryTone = (category: string | null | undefined) =>
  TONES[(category ?? '').trim().toUpperCase()] ?? NONE;
