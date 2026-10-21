import { HeroWaves } from '@/presentation/components/layout/HeroWaves';
import { useSearchParams } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';
import { CATEGORY_ORDER, GROUP_TYPES, filterGroups, type GroupType } from '@/domain/groups/group';
import { GroupCard } from '@/presentation/components/groups/GroupCard';
import { GroupRow, GroupRowHeader } from '@/presentation/components/groups/GroupRow';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { ClearFilters, FilterSelect } from '@/presentation/components/ui/FilterSelect';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useGroups } from '@/presentation/hooks/use-groups';
import { useLabels } from '@/presentation/hooks/use-labels';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';

const fieldClass =
  'h-11 rounded-xl bg-canvas-cream text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';

export function GroupsPage() {
  const { data, isError, error, refetch } = useGroups();
  const { t } = useTranslation(['groups', 'common', 'authors']);
  const { number, domain } = useLabels();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const catParam = params.get('cat');
  const view: 'lista' | 'tarjetas' = params.get('vista') === 'tarjetas' ? 'tarjetas' : 'lista';
  const category = (CATEGORY_ORDER as readonly string[]).includes(catParam ?? '') ? catParam : null;
  const typeParam = params.get('tipo') as GroupType | null;
  const type = typeParam && GROUP_TYPES.includes(typeParam) ? typeParam : null;

  const setParam = (k: string, v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        return next;
      },
      { replace: true },
    );

  // Conserva la vista elegida (lista/tarjetas): no es un filtro.
  const clearFilters = () => setParams(view === 'tarjetas' ? { vista: 'tarjetas' } : {}, { replace: true });

  useDocumentMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/grupos',
    noindex: params.size > 0,
  });

  const groups = data ?? [];
  const visible = filterGroups(groups, { search, category, type });
  const byCategory = (c: string) => groups.filter((g) => g.category === c).length;

  const jsonLd = data && {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Grupos de investigación',
    url: absoluteUrl('/grupos'),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: groups.length,
      itemListElement: groups.map((g, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Organization',
          name: g.name,
          identifier: g.code,
          parentOrganization: ORGANIZATION,
          ...(g.gruplacUrl ? { sameAs: g.gruplacUrl } : {}),
        },
      })),
    },
  };

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />
      ) : null}

      <section
        aria-labelledby="groups-title"
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
              id="groups-title"
              className="text-display-hero-mobile font-bold tracking-tight text-surface-container-lowest md:text-display-hero"
            >
              <Trans t={t} i18nKey="title" components={{ hl: <span className="text-secondary-fixed" /> }} />
            </h1>
            <p className="text-body-lg text-primary-fixed-dim">{t('lead')}</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-primary-container pt-2 sm:grid-cols-4">
            {[
              {
                key: 'active',
                label: t('statActive'),
                value: data && groups.length,
                accent: 'text-surface-container-lowest',
              },
              {
                key: 'A1',
                label: t('statCategory', { category: 'A1' }),
                value: data && byCategory('A1'),
                accent: 'text-secondary-fixed',
              },
              {
                key: 'A',
                label: t('statCategory', { category: 'A' }),
                value: data && byCategory('A'),
                accent: 'text-surface-container-lowest',
              },
              {
                key: 'BC',
                label: t('statBC'),
                value: data && byCategory('B') + byCategory('C'),
                accent: 'text-tertiary-fixed',
              },
            ].map((s) => (
              <div key={s.key} className="flex flex-col-reverse">
                <dt className="text-label-sm text-primary-fixed-dim">{s.label}</dt>
                <dd className={`text-stat-metric font-bold ${s.accent}`}>
                  {s.value === undefined ? '—' : number(s.value)}
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
          className="flex flex-col items-stretch gap-4 rounded-2xl bg-surface-container-lowest p-4 shadow-xl lg:flex-row lg:items-center"
        >
          <div className="relative flex flex-1 items-center">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 text-[20px] text-on-surface-variant"
            />
            <label htmlFor="group-search" className="sr-only">
              {t('search')}
            </label>
            <input
              id="group-search"
              type="search"
              value={search}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder={t('searchPlaceholder')}
              autoComplete="off"
              className={`${fieldClass} w-full pr-4 pl-10 text-body-sm`}
            />
          </div>
          <FilterSelect
            label={t('authors:mincienciasCategory')}
            value={category ?? ''}
            onChange={(v) => setParam('cat', v)}
            options={[
              ['', t('allCategories')],
              ...CATEGORY_ORDER.map((c) => [c, t('statCategory', { category: c })] as [string, string]),
            ]}
          />
          <FilterSelect
            label={t('typeLabel')}
            value={type ?? ''}
            onChange={(v) => setParam('tipo', v)}
            options={[
              ['', t('allTypes')],
              ['institucional', domain('Institucional')],
              ['interinstitucional', domain('Interinstitucional')],
            ]}
          />
          <ClearFilters
            show={Boolean(search || category || type)}
            label={t('common:feedback.resetFilters')}
            onClick={clearFilters}
          />
        </form>
      </div>

      <section aria-labelledby="groups-list-title" className="w-full py-16">
        <div className="container-page">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-label-md font-bold tracking-widest text-secondary uppercase">
                  {t('eyebrow')}
                </p>
                <p
                  aria-live="polite"
                  className="inline-flex items-center gap-2 rounded-full bg-badge-sage-bg px-3 py-1 text-label-md font-semibold text-badge-sage-text"
                >
                  <Icon name="groups" className="text-[16px]" />
                  {data ? t('count', { count: visible.length }) : t('loadingGroups')}
                </p>
              </div>
              <h2
                id="groups-list-title"
                className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg"
              >
                {t('listTitle')}
              </h2>
              <p className="mt-1 max-w-2xl text-body-md text-neutral-muted">{t('listLead')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div
                role="group"
                aria-label={t('viewLabel')}
                className="inline-flex rounded-lg bg-surface-container-lowest p-1 ring-1 ring-border-subtle"
              >
                {(
                  [
                    { id: 'lista', label: t('viewList'), icon: 'view_list' },
                    { id: 'tarjetas', label: t('viewCards'), icon: 'grid_view' },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={view === v.id}
                    onClick={() => setParam('vista', v.id === 'lista' ? '' : v.id)}
                    aria-label={v.label}
                    title={v.label}
                    className={`inline-flex items-center rounded-md p-1.5 text-label-md font-semibold transition-colors ${
                      view === v.id
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    <Icon name={v.icon} className="text-[20px]" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {data ? (
            visible.length ? (
              view === 'lista' ? (
                <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm ring-1 ring-border-subtle">
                  <GroupRowHeader />
                  <ul className="divide-y divide-border-subtle">
                    {visible.map((g) => (
                      <GroupRow key={g.id} group={g} />
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[2200px]:grid-cols-6">
                  {visible.map((g) => (
                    <GroupCard key={g.id} group={g} />
                  ))}
                </div>
              )
            ) : (
              <EmptyState
                title={t('emptyTitle')}
                action={
                  <button type="button" onClick={clearFilters} className={feedbackButtonClass}>
                    {t('common:feedback.resetFilters')}
                  </button>
                }
              >
                {t('emptyBody')}
              </EmptyState>
            )
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : (
            <div
              aria-busy="true"
              aria-label={t('loading')}
              className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[2200px]:grid-cols-6"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="h-[440px] animate-pulse rounded-[24px] bg-surface-container-lowest motion-reduce:animate-none"
                />
              ))}
            </div>
          )}
        </div>
      </section>
      <ContactCta />
    </>
  );
}
