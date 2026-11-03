import { useTranslation } from 'react-i18next';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';
import type { Indicator, ResearchIndicatorMap } from '@/presentation/hooks/use-research-indicators';

const METRICS = [
  { key: 'projects', icon: 'science' },
  { key: 'groups', icon: 'groups' },
  { key: 'products', icon: 'menu_book' },
  { key: 'relations', icon: 'public' },
] as const;

function MetricValue({ indicator, label }: { indicator: Indicator; label: string }) {
  const { t } = useTranslation('home');
  const { number } = useLabels();
  const note = 'text-label-md font-semibold text-neutral-muted';
  switch (indicator.status) {
    case 'loading':
      return (
        <span className="block h-9 w-16 animate-pulse rounded bg-surface-cream-alt motion-reduce:animate-none" />
      );
    case 'error':
      return (
        <span className="flex items-center gap-1">
          <span className={note}>{t('indicators.unavailable')}</span>
          <button
            type="button"
            onClick={indicator.retry}
            aria-label={t('indicators.retry', { area: label })}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:bg-surface-cream-alt"
          >
            <Icon name="refresh" className="text-[20px]" />
          </button>
        </span>
      );
    case 'empty':
      return <span className={note}>{t('indicators.empty')}</span>;
    case 'ready':
      return (
        <span className="text-stat-metric font-bold text-primary-container tabular-nums">
          {number(indicator.value)}
        </span>
      );
  }
}

export function ResearchIndicators({ indicators }: { indicators: ResearchIndicatorMap }) {
  const { t } = useTranslation('home');
  return (
    <section
      aria-labelledby="indicators-title"
      className="w-full border-b border-surface-container bg-surface-container-lowest py-12"
    >
      <h2 id="indicators-title" className="sr-only">
        {t('indicators.title')}
      </h2>
      <dl className="container-page grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
        {METRICS.map(({ key, icon }) => {
          const indicator = indicators[key];
          const label = t(`indicators.${key}`);
          return (
            <div key={key} className="flex items-start gap-4 rounded-xl p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-badge-sage-bg text-primary-container">
                <Icon name={icon} className="text-[24px]" />
              </span>
              <div className="flex min-w-0 flex-col-reverse">
                <dt className="text-body-sm font-bold text-on-surface">
                  {label}
                  {/* Altura reservada: la nota llega sin mover la métrica. */}
                  <span className="mt-0.5 block min-h-4 text-label-md font-normal text-neutral-muted">
                    {indicator.status === 'ready' ? indicator.note : null}
                  </span>
                </dt>
                <dd className="flex min-h-11 items-center">
                  <MetricValue indicator={indicator} label={label} />
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
