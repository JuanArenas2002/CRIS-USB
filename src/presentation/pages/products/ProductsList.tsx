import { useTranslation } from 'react-i18next';
import type { PublicationPage, PublicationStats } from '@/domain/publications/publication';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { Pagination } from '@/presentation/components/ui/Pagination';
import type { usePublicationSearch, usePublications } from '@/presentation/hooks/use-publications';
import { ActiveFilters } from './ActiveFilters';
import { PublicationsTable } from './PublicationsTable';
import { RankingCriteria } from './RankingCriteria';

interface Props {
  list: ReturnType<typeof usePublications>;
  filters: ReturnType<typeof usePublicationSearch>['filters'];
  stats: PublicationStats | undefined;
  onReset: () => void;
}

/** Lista paginada del ranking con sus estados: cargando, error, sin datos, sin resultados y con resultados. */
export function ProductsList({ list, filters, stats, onReset }: Props) {
  const { t } = useTranslation(['publications', 'common']);
  return (
    <section aria-labelledby="products-list-title" className="w-full py-16">
      <div className="container-page">
        <div className="mb-8 flex flex-col">
          <div className="flex flex-wrap items-center gap-3">
            <p
              aria-live="polite"
              className="inline-flex items-center gap-2 rounded-full bg-badge-sage-bg px-3 py-1 text-label-md font-semibold text-badge-sage-text"
            >
              {list.isFetching ? (
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-badge-sage-text/30 border-t-badge-sage-text motion-reduce:animate-none"
                />
              ) : (
                <Icon name="article" className="text-[16px]" />
              )}
              {list.data ? t('count', { count: list.data.total }) : t('loadingList')}
            </p>
          </div>
          <h2
            id="products-list-title"
            className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg"
          >
            {t('listTitle')}
          </h2>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <ActiveFilters filters={filters} />
          <RankingCriteria />
        </div>

        {/* Al cambiar filtro o página: barra de progreso y la lista anterior atenuada. */}
        <div
          aria-hidden="true"
          className={`mb-4 h-1 overflow-hidden rounded-full bg-surface-cream-alt transition-opacity ${
            list.isFetching && list.data ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="loading-bar h-full w-2/5 rounded-full bg-secondary" />
        </div>
        <ListBody list={list} noData={stats?.total === 0} onReset={onReset} />
      </div>
    </section>
  );
}

function ListBody({ list, noData, onReset }: { list: Props['list']; noData: boolean; onReset: () => void }) {
  const { t } = useTranslation(['publications', 'common']);
  if (list.data) {
    if (list.data.items.length) return <Results page={list.data} placeholder={list.isPlaceholderData} />;
    if (noData) return <EmptyState title={t('noDataTitle')}>{t('noDataBody')}</EmptyState>;
    return (
      <EmptyState
        title={t('emptyTitle')}
        action={
          <button type="button" onClick={onReset} className={feedbackButtonClass}>
            {t('common:feedback.resetFilters')}
          </button>
        }
      >
        {t('emptyBody')}
      </EmptyState>
    );
  }
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  return (
    <div
      aria-busy="true"
      aria-label={t('loading')}
      className="h-96 animate-pulse rounded-xl bg-surface-container-lowest motion-reduce:animate-none"
    />
  );
}

function Results({ page, placeholder }: { page: PublicationPage; placeholder: boolean }) {
  return (
    <>
      <div
        aria-busy={placeholder}
        className={`transition-opacity duration-200 xl:overflow-hidden xl:rounded-xl xl:bg-surface-container-lowest xl:shadow-sm ${
          placeholder ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <PublicationsTable items={page.items} />
      </div>
      <Pagination page={page.page} pages={page.pages} />
    </>
  );
}
