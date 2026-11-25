import { useTranslation } from 'react-i18next';
import { InfoDialog } from '@/presentation/components/ui/InfoDialog';
import { RANKING_CRITERIA, RANKING_MAX_WEIGHT } from './ranking-criteria';

/** Botón + modal con los criterios del ranking de publicaciones y su peso. Mismo modal que el índice de investigadores. */
export function RankingCriteria() {
  const { t, i18n } = useTranslation('publications');
  const pct = (n: number) => `${n.toLocaleString(i18n.language)} %`;
  return (
    <InfoDialog
      trigger={t('criteria.button')}
      title={t('criteria.title')}
      lead={t('criteria.lead')}
      closeLabel={t('criteria.close')}
      footer={
        <>
          <span>{t('criteria.total')}</span>
          <span className="text-label-md font-bold tabular-nums">{pct(100)}</span>
        </>
      }
    >
      <ul className="flex flex-col gap-5">
        {RANKING_CRITERIA.map(([key, weight]) => (
          <li key={key}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-body-sm font-bold text-primary">{t(`criteria.items.${key}.name`)}</span>
              <span className="text-body-sm font-semibold text-primary tabular-nums">{pct(weight)}</span>
            </div>
            <div aria-hidden="true" className="mt-1 h-1.5 rounded-full bg-surface-cream-alt">
              <div
                className="h-full rounded-full bg-secondary"
                style={{ width: `${(weight / RANKING_MAX_WEIGHT) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-label-sm text-neutral-muted">{t(`criteria.items.${key}.desc`)}</p>
          </li>
        ))}
      </ul>
    </InfoDialog>
  );
}
