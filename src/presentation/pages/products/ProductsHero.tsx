import { Trans, useTranslation } from 'react-i18next';
import type { PublicationStats } from '@/domain/publications/publication';
import { Trajectory } from '@/presentation/components/ui/Trajectory';
import { useLabels } from '@/presentation/hooks/use-labels';
import { statCards } from './products-model';

export function ProductsHero({ stats }: { stats: PublicationStats | undefined }) {
  const { t } = useTranslation(['publications', 'common']);
  const { number } = useLabels();
  return (
    <section
      aria-labelledby="products-title"
      className="relative w-full overflow-hidden bg-surface-dark-forest pt-10 pb-16 text-on-primary"
    >
      <Trajectory variant="discovery" />
      <div className="relative container-page flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-label-sm tracking-wide text-primary-fixed">
            <span className="h-2 w-2 rounded-full bg-secondary-fixed" /> {t('common:heroBadge')}
          </p>
          <span className="text-label-sm text-primary-fixed-dim">{t('crumb')}</span>
        </div>
        <div className="flex max-w-3xl flex-col gap-2">
          <h1
            id="products-title"
            className="text-display-hero-mobile font-bold tracking-tight text-surface-container-lowest md:text-display-hero"
          >
            <Trans t={t} i18nKey="title" components={{ hl: <span className="text-secondary-fixed" /> }} />
          </h1>
          <p className="text-body-lg text-primary-fixed-dim">{t('lead')}</p>
        </div>
        <dl className="grid grid-cols-2 gap-4 border-t border-primary-container pt-2 sm:grid-cols-4">
          {statCards(t, stats).map((x) => (
            <div key={x.key} className="flex flex-col-reverse">
              <dt className="text-label-sm text-primary-fixed-dim">{x.label}</dt>
              <dd className={`text-stat-metric font-bold ${x.accent}`}>
                {x.value === undefined ? '—' : number(x.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
