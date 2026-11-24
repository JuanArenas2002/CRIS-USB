import type { Overview } from '@/infrastructure/news/analytics-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { C, fmtRange } from './format';
import { kpiDelta, kpiValue, type Kind, type KpiSpec } from './kpis';

function Sparkline({ values }: { values: (number | null)[] }) {
  const v = values.map((x) => x ?? 0);
  if (v.length < 2 || !v.some(Boolean)) return <div className="h-8" />;
  const max = Math.max(...v);
  const pts = v.map(
    (x, i) => `${((i / (v.length - 1)) * 100).toFixed(2)},${(30 - (x / max) * 26).toFixed(2)}`,
  );
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <polygon points={`0,32 ${pts.join(' ')} 100,32`} fill={C.main} fillOpacity={0.08} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={C.main}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const TONE_CLASS = {
  up: 'bg-secondary/10 text-secondary',
  down: 'bg-error/10 text-error',
  flat: 'bg-canvas-cream text-neutral-muted',
};
const TONE_ICON = { up: 'trending_up', down: 'trending_down', flat: 'remove' };

function Delta({ cur, prev, kind }: { cur: number | null; prev: number | null; kind: Kind }) {
  const delta = kpiDelta(cur, prev, kind);
  if (!delta) return <span className="text-label-sm text-neutral-muted">Sin base de comparación</span>;
  return (
    <span
      className={`inline-flex items-center gap-0.5 self-start rounded-full px-2 py-0.5 text-label-sm font-bold tabular-nums ${TONE_CLASS[delta.tone]}`}
    >
      <Icon name={TONE_ICON[delta.tone]} className="text-[14px]" />
      {delta.text}
    </span>
  );
}

export function KpiStrip({ data, items }: { data: Overview; items: KpiSpec[] }) {
  return (
    <section aria-label="Indicadores principales">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-title-md font-bold text-on-surface">Indicadores</h2>
        <p className="text-label-sm text-neutral-muted">
          Variación vs. {fmtRange(data.period.previous_start, data.period.previous_end)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 print:grid-cols-3">
        {items.map((k) => {
          const cur = data.totals[k.key];
          const prev = data.previous[k.key];
          return (
            <div key={k.key} className="flex min-w-0 flex-col gap-2 bg-surface-container-lowest p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label-md font-semibold text-on-surface-variant" title={k.hint}>
                  {k.label}
                </span>
                {k.tag && (
                  <span className="rounded-full bg-canvas-cream px-2 py-0.5 text-label-sm text-neutral-muted">
                    {k.tag}
                  </span>
                )}
              </div>
              <span className="text-[1.875rem] leading-tight font-bold tracking-tight text-on-surface tabular-nums">
                {kpiValue(k.kind, cur)}
              </span>
              <Delta cur={cur} prev={prev} kind={k.kind} />
              {k.spark ? <Sparkline values={data.timeline.map(k.spark)} /> : <div className="h-8" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
