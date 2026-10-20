import { useTranslation } from 'react-i18next';
import { AuthorCard, AuthorCardSkeleton } from '@/presentation/components/authors/AuthorCard';
import { DirectoryFilters } from '@/presentation/components/authors/DirectoryFilters';
import { DirectoryHero } from '@/presentation/components/authors/DirectoryHero';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { Pagination } from '@/presentation/components/ui/Pagination';
import { useAuthorSearch } from '@/presentation/hooks/use-author-search';
import { useAuthors, useAuthorStats, useFeaturedAuthors } from '@/presentation/hooks/use-authors';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useGroups } from '@/presentation/hooks/use-groups';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { ORGANIZATION, SITE_NAME, SITE_URL, safeJson } from '@/shared/seo';
import { DIRECTORY_PAGE_SIZE } from '@/application/authors/author-queries';

// WebSite + la universidad como Organization (tipo que Google reconoce en resultados enriquecidos).
// ponytail: sin `logo` hasta tener una versión cuadrada ≥ 112 px (el logo actual es 400×65).
const websiteJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL + '/',
    inLanguage: 'es-CO',
    publisher: ORGANIZATION,
  },
  {
    '@context': 'https://schema.org',
    ...ORGANIZATION,
    alternateName: 'Unisimón',
    sameAs: ['https://www.unisimon.edu.co'],
  },
];

export function DirectoryPage() {
  const { t } = useTranslation(['authors', 'common']);
  const { number } = useLabels();
  const search = useAuthorSearch();
  const list = useAuthors(search.filters);
  const stats = useAuthorStats();
  const featured = useFeaturedAuthors();
  const groups = useGroups();
  const centers = useCenters();

  useDocumentMetadata({
    title: t('directory.metaTitle'),
    description: t('directory.metaDescription'),
    path: '/',
    // Búsquedas, filtros y páginas >1 no se indexan: los perfiles se descubren por enlaces y sitemap.
    noindex: search.isFiltered,
  });

  const data = list.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / DIRECTORY_PAGE_SIZE)) : 1;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(websiteJsonLd) }} />
      <DirectoryHero stats={stats.data} />
      <DirectoryFilters
        term={search.term}
        onTermChange={search.setTerm}
        category={search.category}
        onCategoryChange={search.setCategory}
        groupId={search.groupId}
        onGroupChange={search.setGroupId}
        groups={groups.data ?? []}
        centerId={search.centerId}
        onCenterChange={search.setCenterId}
        centers={centers.data ?? []}
      />

      {/* Destacados: solo en la vista sin filtros, para no duplicar resultados de una búsqueda. */}
      {/* Si el directorio ya es solo de destacados (ONLY_SELECTED), la sección sobra. */}
      {!search.isFiltered && featured.data?.length && (stats.data?.total ?? 0) > featured.data.length ? (
        <section aria-labelledby="featured-title" className="w-full pt-16">
          <div className="container-page">
            <p className="text-label-md font-bold tracking-widest text-secondary uppercase">
              {t('directory.featuredEyebrow')}
            </p>
            <h2
              id="featured-title"
              className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg"
            >
              {t('directory.featuredTitle')}
            </h2>
            <p className="mt-1 mb-10 max-w-2xl text-body-md text-neutral-muted">
              {t('directory.featuredLead')}
            </p>
            <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {featured.data.map((a) => (
                <AuthorCard key={a.id} author={a} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section id="directorio" aria-labelledby="directory-title" className="w-full scroll-mt-24 py-16">
        <div className="container-page">
          <div className="mb-10 flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <div className="flex flex-col">
              <p className="text-label-md font-bold tracking-widest text-secondary uppercase">
                {t('directory.eyebrow')}
              </p>
              <h2
                id="directory-title"
                className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg"
              >
                {t('directory.title')}
              </h2>
              <p className="mt-1 max-w-2xl text-body-md text-neutral-muted">{t('directory.lead')}</p>
            </div>
            <p
              aria-live="polite"
              className="inline-flex items-center gap-2 self-start rounded-full bg-badge-sage-bg px-3.5 py-1.5 text-label-md font-semibold text-badge-sage-text md:self-end"
            >
              <Icon name="groups" className="text-[16px]" />
              {data
                ? t('directory.profiles', { count: data.total, value: number(data.total) })
                : t('directory.loadingProfiles')}
            </p>
          </div>

          {data ? (
            data.items.length ? (
              <>
                <div
                  aria-busy={list.isPlaceholderData}
                  className={`grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[2200px]:grid-cols-6 ${list.isPlaceholderData ? 'opacity-60' : ''}`}
                >
                  {data.items.map((a) => (
                    <AuthorCard key={a.id} author={a} />
                  ))}
                </div>
                <Pagination page={search.filters.page} pages={pageCount} />
              </>
            ) : (
              <EmptyState
                title={t('directory.emptyTitle')}
                action={
                  <button type="button" onClick={search.reset} className={feedbackButtonClass}>
                    {t('common:feedback.resetFilters')}
                  </button>
                }
              >
                {search.hasActiveFilters ? t('directory.emptyFiltered') : t('directory.emptyPage')}
              </EmptyState>
            )
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (
            <div
              aria-busy="true"
              aria-label={t('directory.loading')}
              className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[2200px]:grid-cols-6"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <AuthorCardSkeleton key={i} />
              ))}
            </div>
          )}
        </div>
      </section>
      <ContactCta />
    </>
  );
}
