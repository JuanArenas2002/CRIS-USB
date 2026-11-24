import { useTranslation } from 'react-i18next';
import type { PublicationStats } from '@/domain/publications/publication';
import { ClearFilters, FilterSelect } from '@/presentation/components/ui/FilterSelect';
import { Icon } from '@/presentation/components/ui/Icon';
import { useLabels } from '@/presentation/hooks/use-labels';
import type { usePublicationSearch } from '@/presentation/hooks/use-publications';
import { selectableYears, toOptions, yearFromOptions, yearToOptions } from './products-model';

const fieldClass =
  'h-11 rounded-xl bg-canvas-cream text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';

interface Props {
  search: ReturnType<typeof usePublicationSearch>;
  stats: PublicationStats | undefined;
}

/** Búsqueda y filtros (años, tipo, área, orden y acceso abierto); todo vive en la URL. */
export function ProductsFilters({ search, stats }: Props) {
  const { t } = useTranslation(['publications', 'common']);
  const { domain } = useLabels();
  const { filters } = search;
  const years = selectableYears(stats?.years, filters);
  return (
    <div className="relative z-30 container-page -mt-7">
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-3 rounded-2xl bg-surface-container-lowest p-4 shadow-xl"
      >
        <div className="relative flex items-center">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 text-[20px] text-on-surface-variant"
          />
          <label htmlFor="publication-search" className="sr-only">
            {t('search')}
          </label>
          <input
            id="publication-search"
            type="search"
            value={search.term}
            onChange={(e) => search.setTerm(e.target.value)}
            placeholder={t('searchPlaceholder')}
            autoComplete="off"
            className={`${fieldClass} w-full pr-4 pl-10 text-body-sm`}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            className=""
            label={t('yearFrom')}
            value={filters.yearFrom ? String(filters.yearFrom) : ''}
            onChange={(v) => search.set('desde', v)}
            options={yearFromOptions(t, years, filters.yearTo)}
          />
          <FilterSelect
            className=""
            label={t('yearTo')}
            value={filters.yearTo ? String(filters.yearTo) : ''}
            onChange={(v) => search.set('hasta', v)}
            options={yearToOptions(t, years, filters.yearFrom)}
          />
          <FilterSelect
            className=""
            label={t('type')}
            value={filters.type ?? ''}
            onChange={(v) => search.set('tipo', v)}
            options={[['', t('allTypes')], ...toOptions(stats?.types ?? [], domain)]}
          />
          <FilterSelect
            className=""
            label={t('area')}
            value={filters.area ?? ''}
            onChange={(v) => search.set('area', v)}
            options={[['', t('allAreas')], ...toOptions(stats?.areas ?? [], domain)]}
          />
          <FilterSelect
            className=""
            label={t('sort')}
            value={filters.sort === 'rank' ? '' : (filters.sort ?? '')}
            onChange={(v) => search.set('orden', v)}
            options={[
              ['', t('sortRank')],
              ['recent', t('sortRecent')],
              ['cited', t('sortCited')],
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt">
            <input
              type="checkbox"
              checked={!!filters.openAccess}
              onChange={(e) => search.set('oa', e.target.checked ? '1' : '')}
              className="h-4 w-4 accent-secondary"
            />
            {t('openAccessOnly')}
          </label>
          <ClearFilters
            show={search.hasActiveFilters}
            label={t('common:feedback.resetFilters')}
            onClick={search.reset}
          />
        </div>
      </form>
    </div>
  );
}
