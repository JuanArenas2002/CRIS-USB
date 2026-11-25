import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PublicationFilters } from '@/application/publications/publication-queries';
import { EmptyState, ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { usePublicationsByYear } from '@/presentation/hooks/use-publications';

const PublicationsByYear = lazy(() => import('@/presentation/components/publications/PublicationsByYear'));

/** Botón y gráfico de publicaciones por año con los mismos filtros que la tabla; no se descarga nada hasta que se pide. */
export function ProductsChart({ filters }: { filters: PublicationFilters }) {
  const { t } = useTranslation(['publications', 'common']);
  const [showChart, setShowChart] = useState(false);
  const byYear = usePublicationsByYear(filters, showChart);
  const chartRows = byYear.data ?? [];
  return (
    <div className="container-page mt-gutter flex flex-col gap-gutter">
      <button
        type="button"
        aria-expanded={showChart}
        aria-controls="pubs-chart"
        onClick={() => setShowChart((v) => !v)}
        className="inline-flex h-11 items-center gap-2 self-end rounded-xl bg-primary px-4 text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-secondary"
      >
        <Icon name={showChart ? 'close' : 'show_chart'} className="text-[20px]" />
        {t(showChart ? 'byYear.hide' : 'byYear.show')}
      </button>
      {showChart ? (
        <div id="pubs-chart">
          {byYear.isError ? (
            <ErrorState error={byYear.error} onRetry={() => void byYear.refetch()} />
          ) : !byYear.data ? (
            <ChartSkeleton label={t('loading')} years={8} />
          ) : chartRows.length ? (
            <Suspense fallback={<ChartSkeleton label={t('loading')} years={chartRows.length} />}>
              <PublicationsByYear rows={chartRows} />
            </Suspense>
          ) : (
            <EmptyState title={t('emptyTitle')}>{t('emptyBody')}</EmptyState>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Esqueleto con la forma del gráfico (encabezado, 4 tarjetas, líneas y tabla) mientras se descarga. */
function ChartSkeleton({ label, years }: { label: string; years: number }) {
  const bone = 'shimmer rounded-md';
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_4px_20px_-2px_rgba(21,71,52,0.06),0_2px_6px_-1px_rgba(0,0,0,0.03)]"
    >
      <div className="flex flex-col gap-5 border-b border-surface-cream-alt p-5 md:p-7">
        <div className="flex flex-col gap-2">
          <span className={`${bone} h-3.5 w-36`} />
          <span className={`${bone} h-7 w-72 max-w-full`} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border-subtle p-3.5">
              <span className={`${bone} h-3 w-3/4`} />
              <span className={`${bone} h-7 w-16`} />
              <span className={`${bone} h-2.5 w-1/2`} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 p-5 md:p-7">
        {/* Líneas del gráfico: barras horizontales finas a distintas alturas sobre la cuadrícula. */}
        <div className="relative h-72 rounded-xl border border-dashed border-border-subtle">
          {['top-[22%]', 'top-[40%]', 'top-[58%]', 'top-[74%]'].map((top) => (
            <span key={top} className={`${bone} absolute right-4 left-4 h-1.5 ${top}`} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((r) => (
            <div key={r} className="flex gap-2">
              <span className={`${bone} h-6 w-40 shrink-0`} />
              {Array.from({ length: Math.min(Math.max(years, 1), 10) }, (_, c) => (
                <span key={c} className={`${bone} h-6 flex-1`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
