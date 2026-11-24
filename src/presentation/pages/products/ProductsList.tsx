import { useTranslation } from 'react-i18next';
import type { PublicationPage, PublicationStats } from '@/domain/publications/publication';
import { ProductRows } from '@/presentation/components/authors/ProductsTable';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { Pagination } from '@/presentation/components/ui/Pagination';
import type { usePublications } from '@/presentation/hooks/use-publications';
import { publicationToProduct } from './products-model';

interface Props {
  list: ReturnType<typeof usePublications>;
  stats: PublicationStats | undefined;
  onReset: () => void;
}

/** Lista paginada del ranking con sus estados: cargando, error, sin datos, sin resultados y con resultados. */
export function ProductsList({ list, stats, onReset }: Props) {
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
  const { t } = useTranslation(['publications', 'common']);
  const openAccess = t('item.openAccess');
  return (
    <>
      <div
        aria-busy={placeholder}
        className={`overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm transition-opacity duration-200 ${
          placeholder ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        <ProductRows
          products={page.items.map((p) => publicationToProduct(p, openAccess))}
          rank={{
            label: t('item.colRank'),
            of: (row) => {
              const p = page.items.find((x) => x.eid === row.key)!;
              return (
                <span className="inline-flex flex-col items-center leading-tight">
                  <span className="text-body-md font-bold text-primary">
                    <span className="sr-only">{t('item.rank', { rank: p.position })}</span>
                    <span aria-hidden="true">#{p.position}</span>
                  </span>
                  {/* Con filtros, el puesto es dentro del resultado: se muestra el general. */}
                  {p.position !== p.rank ? (
                    <span className="text-label-sm text-neutral-muted">
                      {t('item.general', { rank: p.rank })}
                    </span>
                  ) : null}
                </span>
              );
            },
          }}
        />
      </div>
      <Pagination page={page.page} pages={page.pages} />
    </>
  );
}
