// Contenedores y barras compartidos por los bloques del informe.
import type { ReactNode } from 'react';
import { C, fmtInt, fmtPct } from './format';

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 print:break-inside-avoid">
      <h2 className="text-title-md font-bold text-on-surface">{title}</h2>
      {description && <p className="mt-0.5 mb-4 text-body-sm text-neutral-muted">{description}</p>}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-canvas-cream px-4 py-8 text-center text-body-sm text-neutral-muted">
      {children}
    </p>
  );
}

/** Magnitud por categoría: barras de un solo tono, valor y porcentaje sobre el total (base explícita). */
export function Bars({
  rows,
  labels,
  unit,
  empty,
  sortByValue = true,
}: {
  rows: { key: string; value: number }[];
  labels?: Record<string, string>;
  unit: string;
  empty: string;
  sortByValue?: boolean;
}) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <Empty>{empty}</Empty>;
  const max = Math.max(...rows.map((r) => r.value));
  const list = sortByValue ? [...rows].sort((a, b) => b.value - a.value) : rows;
  return (
    <div>
      <ul className="flex flex-col gap-3">
        {list.map((r) => (
          <li key={r.key} className="text-body-sm">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-on-surface" title={labels?.[r.key] ?? r.key}>
                {labels?.[r.key] ?? r.key}
              </span>
              <span className="shrink-0 text-on-surface-variant tabular-nums">
                <b className="text-on-surface">{fmtInt(r.value)}</b> · {fmtPct(r.value / total)}
              </span>
            </div>
            <span className="block h-2 rounded-full bg-canvas-cream" aria-hidden="true">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, background: C.main }}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-label-sm text-neutral-muted">
        Base: {fmtInt(total)} {unit}
      </p>
    </div>
  );
}
