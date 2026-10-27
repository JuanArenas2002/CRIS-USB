import { Trans, useTranslation } from 'react-i18next';
import { publicationUrl, type ListedPublication, type Quartile } from '@/domain/publications/publication';
import { scopusProductType, type Product } from '@/domain/authors/author';
import { ProductRows } from '@/presentation/components/authors/ProductsTable';
import { HeroWaves } from '@/presentation/components/layout/HeroWaves';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { ClearFilters, FilterSelect } from '@/presentation/components/ui/FilterSelect';
import { Pagination } from '@/presentation/components/ui/Pagination';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import {
  usePublicationSearch,
  usePublicationStats,
  usePublications,
} from '@/presentation/hooks/use-publications';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';

const fieldClass =
  'h-11 rounded-xl bg-canvas-cream text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';

/** Producción científica destacada: ranking de publicaciones Scopus cargado en /admin/produccion. */
/**
 * Publicación del ranking → fila de la tabla de productos del investigador. Cuartil, citas y
 * acceso abierto van en el detalle bajo el tipo; el orden sigue siendo el del ranking.
 */
function useAsProduct() {
  const { t } = useTranslation('publications');
  return (p: ListedPublication): Product => ({
    key: p.eid,
    typology: 'GNC',
    type: scopusProductType(p.type),
    title: p.title,
    authors: null,
    year: p.year,
    venue: p.journal,
    index: [
      'Scopus',
      p.quartile,
      t('item.citations', { count: p.citations }),
      p.openAccess ? t('item.openAccess') : null,
    ]
      .filter(Boolean)
      .join(' · '),
    doi: p.doi,
    url: publicationUrl(p),
  });
}

export function ProductsPage() {
  const asProduct = useAsProduct();
  const { t } = useTranslation(['publications', 'common']);
  const { number, domain } = useLabels();
  const search = usePublicationSearch();
  const { filters } = search;
  const stats = usePublicationStats();
  const list = usePublications(filters);
  const s = stats.data;

  useDocumentMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/productos',
    // Vacío o filtrado: no se indexa.
    noindex: search.isFiltered || s?.total === 0,
  });

  const jsonLd = list.data &&
    !search.isFiltered && {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: t('metaTitle'),
      url: absoluteUrl('/productos'),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: list.data.total,
        itemListElement: list.data.items.map((p) => ({
          '@type': 'ListItem',
          position: p.position,
          item: {
            '@type': 'ScholarlyArticle',
            name: p.title,
            url: publicationUrl(p),
            ...(p.year ? { datePublished: String(p.year) } : {}),
            ...(p.journal ? { isPartOf: { '@type': 'Periodical', name: p.journal } } : {}),
            ...(p.doi ? { identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi } } : {}),
            sourceOrganization: ORGANIZATION,
          },
        })),
      },
    };

  // Años con publicaciones, más los del rango elegido (un enlace puede traer uno sin publicaciones).
  const years = [
    ...new Set([...(s?.years ?? []), filters.yearFrom ?? 0, filters.yearTo ?? 0].filter(Boolean)),
  ].sort((a, b) => b - a);
  const options = (all: string[], label: (v: string) => string) =>
    all.map((v) => [v, label(v)] as [string, string]);

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />
      ) : null}

      <section
        aria-labelledby="products-title"
        className="relative w-full overflow-hidden bg-surface-dark-forest pt-10 pb-16 text-on-primary"
      >
        <HeroWaves />
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
            {[
              {
                key: 'total',
                label: t('statTotal'),
                value: s?.total,
                accent: 'text-surface-container-lowest',
              },
              { key: 'q1', label: t('statQ1'), value: s?.byQuartile.Q1, accent: 'text-secondary-fixed' },
              {
                key: 'oa',
                label: t('statOpenAccess'),
                value: s?.openAccess,
                accent: 'text-surface-container-lowest',
              },
              { key: 'cites', label: t('statCitations'), value: s?.citations, accent: 'text-tertiary-fixed' },
            ].map((x) => (
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <FilterSelect
              className=""
              label={t('yearFrom')}
              value={filters.yearFrom ? String(filters.yearFrom) : ''}
              onChange={(v) => search.set('desde', v)}
              options={[
                ['', t('anyYearFrom')],
                ...options(years.filter((y) => !filters.yearTo || y <= filters.yearTo).map(String), (y) =>
                  t('fromYear', { year: y }),
                ),
              ]}
            />
            <FilterSelect
              className=""
              label={t('yearTo')}
              value={filters.yearTo ? String(filters.yearTo) : ''}
              onChange={(v) => search.set('hasta', v)}
              options={[
                ['', t('anyYearTo')],
                ...options(years.filter((y) => !filters.yearFrom || y >= filters.yearFrom).map(String), (y) =>
                  t('toYear', { year: y }),
                ),
              ]}
            />
            <FilterSelect
              className=""
              label={t('quartile')}
              value={filters.quartile ?? ''}
              onChange={(v) => search.set('cuartil', v)}
              options={[
                ['', t('allQuartiles')],
                ...options(['Q1', 'Q2', 'Q3', 'Q4'], (q) =>
                  s ? `${q} (${number(s.byQuartile[q as Quartile])})` : q,
                ),
              ]}
            />
            <FilterSelect
              className=""
              label={t('type')}
              value={filters.type ?? ''}
              onChange={(v) => search.set('tipo', v)}
              options={[['', t('allTypes')], ...options(s?.types ?? [], domain)]}
            />
            <FilterSelect
              className=""
              label={t('area')}
              value={filters.area ?? ''}
              onChange={(v) => search.set('area', v)}
              options={[['', t('allAreas')], ...options(s?.areas ?? [], domain)]}
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

      <section aria-labelledby="products-list-title" className="w-full py-16">
        <div className="container-page">
          <div className="mb-8 flex flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-label-md font-bold tracking-widest text-secondary uppercase">
                {t('eyebrow')}
              </p>
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
            <p className="mt-1 max-w-2xl text-body-md text-neutral-muted">{t('listLead')}</p>
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
          {list.data ? (
            list.data.items.length ? (
              <>
                <div
                  aria-busy={list.isPlaceholderData}
                  className={`overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm transition-opacity duration-200 ${
                    list.isPlaceholderData ? 'pointer-events-none opacity-50' : ''
                  }`}
                >
                  <ProductRows
                    products={list.data.items.map(asProduct)}
                    rank={{
                      label: t('item.colRank'),
                      of: (row) => {
                        const p = list.data.items.find((x) => x.eid === row.key)!;
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
                <Pagination page={list.data.page} pages={list.data.pages} />
              </>
            ) : s?.total === 0 ? (
              <EmptyState title={t('noDataTitle')}>{t('noDataBody')}</EmptyState>
            ) : (
              <EmptyState
                title={t('emptyTitle')}
                action={
                  <button type="button" onClick={search.reset} className={feedbackButtonClass}>
                    {t('common:feedback.resetFilters')}
                  </button>
                }
              >
                {t('emptyBody')}
              </EmptyState>
            )
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <div
              aria-busy="true"
              aria-label={t('loading')}
              className="h-96 animate-pulse rounded-xl bg-surface-container-lowest motion-reduce:animate-none"
            />
          )}
        </div>
      </section>
      <ContactCta />
    </>
  );
}
