import { useTranslation } from 'react-i18next';
import { AuthorCard, AuthorCardSkeleton } from '@/presentation/components/authors/AuthorCard';
import { DirectoryFilters } from '@/presentation/components/authors/DirectoryFilters';
import { DirectoryHero } from '@/presentation/components/authors/DirectoryHero';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { groupByCenter } from '@/domain/authors/author';
import { withBaseUrl } from '@/shared/base';
import { useAuthorSearch } from '@/presentation/hooks/use-author-search';
import { useAuthors, useAuthorStats } from '@/presentation/hooks/use-authors';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useGroups } from '@/presentation/hooks/use-groups';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { ORGANIZATION, SITE_NAME, SITE_URL, safeJson } from '@/shared/seo';

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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(websiteJsonLd) }} />
      <DirectoryHero stats={stats.data} />
      <DirectoryFilters
        term={search.term}
        onTermChange={search.setTerm}
        category={search.category}
        onCategoryChange={search.setCategory}
        englishLevel={search.englishLevel}
        onEnglishLevelChange={search.setEnglishLevel}
        groupId={search.groupId}
        onGroupChange={search.setGroupId}
        groups={groups.data ?? []}
        centerId={search.centerId}
        onCenterChange={search.setCenterId}
        centers={centers.data ?? []}
        hasActiveFilters={search.hasActiveFilters || search.term.trim() !== ''}
        onReset={search.reset}
      />

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
              <div
                aria-busy={list.isPlaceholderData}
                className={`flex flex-col gap-14 ${list.isPlaceholderData ? 'opacity-60' : ''}`}
              >
                {groupByCenter(data.items).map(({ center, authors }) => {
                  const id = `centro-${center?.id ?? 'ninguno'}`;
                  return (
                    <section key={id} aria-labelledby={id}>
                      <h3
                        id={id}
                        className="mb-6 flex items-center gap-3 border-b border-surface-container pb-3 text-headline-sm font-bold text-primary"
                      >
                        {center?.logoUrl ? (
                          <img
                            src={withBaseUrl(center.logoUrl)}
                            alt=""
                            className="h-9 w-auto max-w-24 object-contain"
                          />
                        ) : (
                          <Icon name="domain" className="text-[24px] text-secondary" />
                        )}
                        <span className="min-w-0">
                          {center
                            ? center.acronym
                              ? `${center.acronym} · ${center.name}`
                              : center.name
                            : t('directory.noCenter')}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-badge-sage-bg px-2.5 py-0.5 text-label-sm font-semibold text-badge-sage-text">
                          {number(authors.length)}
                        </span>
                      </h3>
                      <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2200px]:grid-cols-5">
                        {authors.map((a) => (
                          <AuthorCard key={a.id} author={a} />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
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
              className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[2200px]:grid-cols-5"
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
