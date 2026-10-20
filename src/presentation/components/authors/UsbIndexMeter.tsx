import { useLabels } from '@/presentation/hooks/use-labels';

/**
 * Índice de productividad USB (0–100) como medidor: valor en texto y barra de un solo tono, con la
 * pista en un paso más claro del mismo verde. `showLabel` en false cuando el contenedor ya lo
 * rotula (p. ej. un <dt>); `label` sigue nombrando el medidor para lectores de pantalla.
 */
export function UsbIndexMeter({
  value,
  label,
  showLabel = true,
  caption,
  size = 'sm',
}: {
  value: number;
  label: string;
  showLabel?: boolean;
  caption?: string;
  size?: 'sm' | 'md';
}) {
  const labels = useLabels();
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        {showLabel ? (
          <span className="text-[11px] font-semibold tracking-wider text-neutral-muted uppercase">
            {label}
          </span>
        ) : null}
        <span className="text-on-surface">
          <span className={`font-bold tabular-nums ${size === 'md' ? 'text-headline-sm' : 'text-[15px]'}`}>
            {labels.number(value)}
          </span>
          <span className="text-label-sm text-neutral-muted"> / 100</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className={`overflow-hidden rounded-full bg-secondary/15 ${size === 'md' ? 'h-2' : 'h-1.5'}`}
      >
        <div className="h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
      </div>
      {caption ? <span className="text-label-sm text-neutral-muted">{caption}</span> : null}
    </div>
  );
}
