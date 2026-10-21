import { withBase, withBaseUrl } from '@/shared/base';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  TYPOLOGIES,
  authorSlug,
  categoryOf,
  displayName,
  externalProfiles,
  initials,
  parseAuthorId,
  toProducts,
  type AuthorProfile,
  type TypologyId,
} from '@/domain/authors/author';
import { isIndexable } from '@/application/authors/author-queries';
import { hasPublicDetail } from '@/domain/groups/group';
import { inheritOds } from '@/domain/ods/ods';
import { medalFor } from '@/presentation/components/authors/AuthorCard';
import { ProductionByYear } from '@/presentation/components/authors/ProductionByYear';
import { UsbIndexMeter } from '@/presentation/components/authors/UsbIndexMeter';
import { centerPath } from '@/presentation/components/centers/CenterCard';
import {
  EMPTY_FILTERS,
  ProductsTable,
  type ProductFilters,
} from '@/presentation/components/authors/ProductsTable';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { OdsIcon } from '@/presentation/components/groups/OdsIcons';
import { Icon } from '@/presentation/components/ui/Icon';
import { TabBar } from '@/presentation/components/ui/TabBar';
import { TypologyCard } from '@/presentation/components/ui/TypologyCard';
import { IdLogo } from '@/presentation/components/ui/IdLogo';
import { useAuthor } from '@/presentation/hooks/use-authors';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';

export function AuthorPage() {
  const { slug } = useParams();
  const id = parseAuthorId(slug);
  const { data, isError, error, refetch } = useAuthor(id);
  const { t } = useTranslation(['authors', 'common']);

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = authorSlug(data.author);
    if (slug !== canonical) return <Navigate replace to={`/investigadores/${canonical}`} />;
    return <Profile author={data.author} />;
  }
  return (
    <div className="container-page py-16">
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div
          aria-busy="true"
          aria-label={t('profile.loading')}
          className="h-64 animate-pulse rounded-3xl bg-surface-container-lowest"
        />
      )}
    </div>
  );
}

type Tab = 'perfil' | 'produccion';
const card = 'rounded-xl bg-surface-container-lowest shadow-sm';
const eyebrow = 'text-label-sm tracking-wider text-neutral-muted uppercase';

function Profile({ author }: { author: AuthorProfile }) {
  const name = displayName(author.name);
  const path = `/investigadores/${authorSlug(author)}`;
  const profiles = externalProfiles(author);
  const cat = categoryOf(author.category);
  const { t } = useTranslation(['authors', 'common']);
  const labels = useLabels();
  const catLabel = labels.researcher(author.category);
  const products = useMemo(
    () => (author.production ? toProducts(author.production) : []),
    [author.production],
  );
  const citations = (author.production?.publications ?? []).reduce((s, p) => s + p.citedBy, 0);
  // El grupo principal primero; luego el resto, sin repetir.
  const groups = [
    ...(author.mainGroup
      ? [author.groups.find((g) => g.id === author.mainGroup!.id) ?? author.mainGroup]
      : []),
    ...author.groups.filter((g) => g.id !== author.mainGroup?.id),
  ];
  const ods = inheritOds(groups);
  const centers = author.centers ?? [];

  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'produccion' ? 'produccion' : 'perfil';
  const setTab = (t: Tab) => setParams(t === 'perfil' ? {} : { tab: t }, { replace: true });
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const showTypology = (typology: TypologyId) => {
    setFilters({ ...EMPTY_FILTERS, typology });
    setTab('produccion');
  };

  useDocumentMetadata({
    title: name,
    description: `${t('profile.metaBase', { name, category: catLabel.toLowerCase() })}${
      author.mainGroup ? t('profile.metaGroup', { group: author.mainGroup.name }) : ''
    }${
      author.metrics
        ? t('profile.metaMetrics', {
            publications: author.metrics.scopusPublications,
            hIndex: author.metrics.hIndex ?? '—',
          })
        : ''
    }.`,
    path,
    type: 'profile',
    noindex: !isIndexable(author),
    image: author.photoUrl ?? undefined,
  });

  // Solo propiedades respaldadas por la fuente: nombre, afiliación, grupos e identificadores.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: absoluteUrl(path),
      mainEntity: {
        '@type': 'Person',
        name,
        affiliation: ORGANIZATION,
        ...(author.photoUrl ? { image: absoluteUrl(author.photoUrl) } : {}),
        ...(groups.length || centers.length
          ? {
              memberOf: [
                ...groups.map((g) => ({
                  '@type': 'Organization',
                  name: g.name,
                  identifier: g.code,
                  ...(hasPublicDetail(g) ? { url: absoluteUrl(`/grupos/${authorSlug(g)}`) } : {}),
                })),
                ...centers.map((c) => ({
                  '@type': 'ResearchOrganization',
                  name: c.name,
                  identifier: c.code,
                  url: absoluteUrl(centerPath(c)),
                })),
              ],
            }
          : {}),
        ...(author.orcid
          ? { identifier: { '@type': 'PropertyValue', propertyID: 'ORCID', value: author.orcid } }
          : {}),
        ...(profiles.length ? { sameAs: profiles.map((p) => p.url) } : {}),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Investigadores', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name, item: absoluteUrl(path) },
      ],
    },
  ];

  return (
    <article className="pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />

      <div className="border-b border-border-subtle bg-surface-container-lowest">
        <nav aria-label={t('common:breadcrumb.label')} className="container-page py-3">
          <ol className="flex flex-wrap items-center gap-1 text-label-md text-neutral-muted">
            <li>
              <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
                <Icon name="home" className="text-[16px]" /> {t('common:breadcrumb.home')}
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" className="text-[16px]" />
            </li>
            <li>
              <a href={withBase('/#directorio')} className="hover:text-primary">
                {t('profile.breadcrumbDirectory')}
              </a>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" className="text-[16px]" />
            </li>
            <li aria-current="page" className="font-semibold text-on-surface">
              {t('profile.breadcrumbCurrent')}
            </li>
          </ol>
        </nav>
      </div>

      <div className="container-page mt-gutter flex flex-col gap-gutter">
        {/* 1. Tarjeta principal del perfil */}
        <section className={`${card} relative overflow-hidden p-4 md:p-6`}>
          <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-secondary-fixed/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary-fixed/20 blur-3xl" />
          <div className="relative z-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="flex flex-col items-center sm:items-start lg:col-span-3">
              {/* Foto asignada en /admin/fotos; si no hay, monograma en el mismo marco de la plantilla. */}
              <div
                aria-hidden="true"
                className="relative flex h-52 w-44 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-badge-sage-bg shadow-md sm:h-64 sm:w-52"
              >
                {author.photoUrl ? (
                  <img
                    src={withBaseUrl(author.photoUrl)}
                    alt=""
                    width={512}
                    height={512}
                    className="absolute inset-0 h-full w-full rounded-xl object-cover object-top"
                  />
                ) : (
                  <span className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-surface-dark-forest text-[34px] font-bold text-secondary-fixed ring-8 ring-white/55">
                    {initials(name)}
                  </span>
                )}
                <span className="absolute right-2 bottom-2 left-2 truncate rounded bg-primary-container/85 px-2.5 py-1 text-center text-label-sm text-on-primary backdrop-blur-md">
                  {t('profile.badge')}
                </span>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between gap-4 lg:col-span-9">
              <div className="flex flex-col gap-1">
                <h1 className="text-headline-lg-mobile font-bold tracking-tight text-primary-container md:text-headline-lg">
                  {name}
                </h1>
                {/* Top 3 de su centro en el ranking USB. */}
                {medalFor(author.ranking?.center ? author.ranking.centerRank : null) ? (
                  <p
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-label-md font-bold shadow-sm ring-2 ${medalFor(author.ranking!.centerRank)}`}
                  >
                    <Icon name="emoji_events" className="text-[20px]" />
                    {t('card.topCenter', {
                      rank: author.ranking!.centerRank,
                      center: author.ranking!.center,
                    })}
                  </p>
                ) : null}
              </div>

              <dl className="grid grid-cols-1 gap-3 rounded-xl bg-surface-cream-alt/60 p-4 sm:grid-cols-2 md:grid-cols-3">
                <Fact
                  icon="school"
                  label={t('profile.degree')}
                  value={author.degree ? labels.domain(author.degree) : '—'}
                />
                {author.englishLevel ? (
                  <Fact icon="translate" label={t('profile.englishLevel')} value={author.englishLevel} />
                ) : null}
                <Fact
                  icon="apartment"
                  label={t('profile.mainGroup')}
                  value={author.mainGroup?.name ?? '—'}
                  hint={author.mainGroup?.code}
                />
                <Fact
                  icon="workspace_premium"
                  label={t('mincienciasCategory')}
                  value={cat ? `${labels.category(cat.id)} (${cat.code})` : t('profile.noCategory')}
                />
                {author.ranking ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <dt className={`flex items-center gap-1.5 ${eyebrow}`}>
                        <Icon name="trending_up" className="text-[16px] text-primary-container" />{' '}
                        {t('profile.usbIndex')}
                      </dt>
                      <dd>
                        <UsbIndexMeter
                          label={t('profile.usbIndex')}
                          showLabel={false}
                          value={author.ranking.index}
                          caption={t('profile.generalRank', { rank: author.ranking.rank })}
                          size="md"
                        />
                      </dd>
                    </div>
                    {author.ranking.center && author.ranking.centerRank ? (
                      <Fact
                        icon="military_tech"
                        label={t('profile.centerRank')}
                        value={t('profile.centerRankValue', {
                          rank: author.ranking.centerRank,
                          center: author.ranking.center,
                        })}
                      />
                    ) : null}
                  </>
                ) : null}
              </dl>

              {groups.length ? (
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant">
                    <Icon name="groups" className="text-[18px] text-primary-container" />{' '}
                    {t('profile.groups')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const chip = (
                        <>
                          <Icon name="science" className="text-[16px] text-secondary" />
                          <span className="font-semibold">{g.name}</span>
                        </>
                      );
                      const box =
                        'inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-1.5 text-body-sm text-on-surface';
                      // Interinstitucionales: sin ficha pública, el grupo se nombra sin enlace.
                      return hasPublicDetail(g) ? (
                        <Link
                          key={g.id}
                          to={`/grupos/${authorSlug(g)}`}
                          className={`group ${box} transition-colors hover:border-primary-container hover:text-primary-container`}
                        >
                          {chip}
                          <Icon
                            name="arrow_forward"
                            className="text-[14px] text-neutral-muted transition-transform group-hover:translate-x-0.5"
                          />
                        </Link>
                      ) : (
                        <span key={g.id} className={box}>
                          {chip}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {centers.length ? (
                <div className="flex flex-col gap-2">
                  <span className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant">
                    <Icon name="domain" className="text-[18px] text-primary-container" />{' '}
                    {t('profile.centers')}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {centers.map((c) => (
                      // Solo logo y sigla; el nombre completo va en el tooltip y para lectores de pantalla.
                      <Link
                        key={c.id}
                        to={centerPath(c)}
                        title={c.name}
                        className="group inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-container-lowest px-2.5 py-1.5 text-body-sm text-on-surface transition-colors hover:border-primary-container hover:text-primary-container"
                      >
                        {c.logoUrl ? (
                          <img
                            src={withBaseUrl(c.logoUrl)}
                            alt=""
                            loading="lazy"
                            className="h-7 w-auto max-w-16 object-contain"
                          />
                        ) : (
                          <Icon name="domain" className="text-[18px] text-secondary" />
                        )}
                        <span className="font-semibold">{c.acronym ?? c.code}</span>
                        <span className="sr-only">{c.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {profiles.length ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant">
                    <Icon name="fingerprint" className="text-[18px] text-primary-container" />{' '}
                    {t('profile.academicProfiles')}
                  </span>
                  {/* Solo el logo; el nombre y el identificador van en un tooltip (hover y foco). */}
                  <ul className="flex flex-wrap gap-2">
                    {profiles.map((p) => (
                      <li key={p.label} className="relative">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener"
                          className="peer flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-container-lowest transition-colors hover:border-primary-container focus-visible:outline-2 focus-visible:outline-primary-container"
                        >
                          <IdLogo label={p.label} size={24} />
                          <span className="sr-only">
                            {p.label}: {labels.domain(p.value)} {t('common:newTab')}
                          </span>
                        </a>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-md bg-surface-dark-forest px-2.5 py-1.5 text-center whitespace-nowrap opacity-0 shadow-md transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
                        >
                          <span className="block text-label-sm font-semibold text-on-primary">{p.label}</span>
                          <span className="block font-mono text-[10px] text-secondary-fixed">
                            {labels.domain(p.value)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {ods.length ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 text-label-md font-semibold text-on-surface-variant">
                    <Icon name="public" className="text-[18px] text-primary-container" />{' '}
                    {t('profile.odsLinked')}
                  </span>
                  {/* Heredados de los grupos del investigador; el tooltip dice de cuál viene cada uno. */}
                  <ul className="flex flex-wrap gap-2">
                    {ods.map((o) => (
                      <li key={o.id}>
                        <OdsIcon
                          id={o.id}
                          size={40}
                          note={t('profile.odsVia', { groups: o.groups.join(', ') })}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* 2. Pestañas */}
        <TabBar
          label={t('profile.tabsLabel')}
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: 'perfil', label: t('profile.tabProfile'), icon: 'analytics' },
            {
              id: 'produccion',
              label: t('profile.tabProduction'),
              icon: 'menu_book',
              badge: products.length ? t('profile.productsBadge', { count: products.length }) : undefined,
            },
          ]}
        />

        {/* 3. Perfil e indicadores */}
        <div id="panel-perfil" role="tabpanel" aria-labelledby="tab-perfil" hidden={tab !== 'perfil'}>
          <div className="flex flex-col gap-gutter">
            <div className="flex flex-col gap-gutter">
              <div className="flex flex-col gap-gutter">
                {author.metrics ? (
                  <>
                    <SectionTitle icon="insights">{t('profile.indicatorsTitle')}</SectionTitle>
                    <div className="grid gap-gutter sm:grid-cols-3">
                      <Kpi
                        label={t('profile.hIndex')}
                        value={author.metrics.hIndex ?? '—'}
                        icon="show_chart"
                      />
                      <Kpi
                        label={t('profile.indexed')}
                        value={author.metrics.scopusPublications}
                        unit={t('profile.articles', { count: author.metrics.scopusPublications })}
                        icon="article"
                      />
                      <Kpi label={t('profile.citations')} value={citations} icon="auto_graph" />
                    </div>
                  </>
                ) : (
                  <div className={`${card} p-6`}>
                    <SectionTitle icon="insights">{t('profile.indicatorsShort')}</SectionTitle>
                    <p className="mt-2 text-body-md text-neutral-muted">{t('profile.indicatorsNone')}</p>
                  </div>
                )}
              </div>
            </div>
            {author.metrics ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
                  <div>
                    <h2 className="text-headline-sm font-semibold text-primary-container">
                      {t('profile.byTypologyTitle')}
                    </h2>
                    <p className="text-body-sm text-neutral-muted">{t('profile.byTypologyLead')}</p>
                  </div>
                  <span className="rounded-full bg-primary-container px-3 py-1 text-label-md font-semibold text-on-primary">
                    {t('profile.totalProducts', { count: products.length })}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
                  {TYPOLOGIES.map((t) => (
                    <TypologyCard
                      key={t.id}
                      typology={t.id}
                      count={products.filter((p) => p.typology === t.id).length}
                      total={products.length}
                      onExplore={() => showTypology(t.id)}
                    />
                  ))}
                </div>
                <ProductionByYear products={products} />
              </>
            ) : null}
          </div>
        </div>

        {/* 4. Producción científica */}
        <div
          id="panel-produccion"
          role="tabpanel"
          aria-labelledby="tab-produccion"
          hidden={tab !== 'produccion'}
        >
          {products.length ? (
            <ProductsTable products={products} filters={filters} onFiltersChange={setFilters} />
          ) : (
            <div className={`${card} p-6 text-body-md text-neutral-muted`}>
              {profiles.length ? t('profile.productionNoneProfiles') : t('profile.productionNoneCvlac')}
            </div>
          )}
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('profile.back')}
        </Link>
      </div>
    </article>
  );
}

function Fact({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className={`flex items-center gap-1.5 ${eyebrow}`}>
        <Icon name={icon} className="text-[16px] text-primary-container" /> {label}
      </dt>
      <dd className="text-body-sm font-semibold text-on-surface">
        {value}
        {hint ? <span className="block text-label-sm font-normal text-neutral-muted">{hint}</span> : null}
      </dd>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon: string;
}) {
  const { t } = useTranslation(['authors', 'common']);
  const { number } = useLabels();
  return (
    <div
      className={`${card} relative flex flex-col justify-between overflow-hidden p-4 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className={eyebrow}>{label}</span>
          <p className="mt-1 flex items-baseline gap-2 text-display-hero-mobile font-bold text-primary-container md:text-display-hero">
            {typeof value === 'number' ? number(value) : value}
            {unit ? <span className="text-body-md font-semibold text-neutral-muted">{unit}</span> : null}
          </p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-badge-sage-bg text-primary-container">
          <Icon name={icon} className="text-[26px]" />
        </span>
      </div>
      <p className="mt-2 rounded-lg bg-surface-cream-alt/60 p-2.5 text-label-sm font-medium text-on-surface-variant">
        {t('profile.source')}
      </p>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-headline-sm font-semibold text-primary-container">
      <Icon name={icon} className="text-[22px] text-secondary" /> {children}
    </h2>
  );
}
