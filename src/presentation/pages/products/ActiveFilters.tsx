import { useTranslation } from 'react-i18next';
import type { PublicationQuery } from '@/domain/publications/publication';
import { useLabels } from '@/presentation/hooks/use-labels';
import { activeFilterParts } from './products-model';

/** Resumen en texto de los filtros activos, sobre la tabla; sin filtros lo dice. */
export function ActiveFilters({ filters }: { filters: Omit<PublicationQuery, 'pageSize'> }) {
  const { t } = useTranslation(['publications', 'common']);
  const { domain } = useLabels();
  const parts = activeFilterParts(t, filters, domain);
  return (
    <p className="text-body-sm text-on-surface-variant">
      <span className="font-bold text-primary">{t('activeFilters.label')}: </span>
      {parts.length ? parts.join(' · ') : t('activeFilters.none')}
    </p>
  );
}
