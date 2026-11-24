import { useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  authorSlug,
  displayName,
  externalProfiles,
  parseAuthorId,
  toProducts,
  type AuthorProfile,
  type TypologyId,
} from '@/domain/authors/author';
import { isIndexable } from '@/application/authors/author-queries';
import { inheritOds } from '@/domain/ods/ods';
import {
  EMPTY_FILTERS,
  ProductsTable,
  type ProductFilters,
} from '@/presentation/components/authors/ProductsTable';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { TabBar } from '@/presentation/components/ui/TabBar';
import { useAuthor } from '@/presentation/hooks/use-authors';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';
import { ProfileAside } from './author/ProfileAside';
import { ProfileHero } from './author/ProfileHero';
import { ProfileIndicators } from './author/ProfileIndicators';
import {
  orderedGroups,
  profileDescription,
  profileJsonLd,
  totalCitations,
  type ProfileTab,
} from './author/profile-model';
import { card } from './author/styles';

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

function Profile({ author }: { author: AuthorProfile }) {
  const name = displayName(author.name);
  const path = `/investigadores/${authorSlug(author)}`;
  const profiles = externalProfiles(author);
  const { t } = useTranslation(['authors', 'common']);
  const labels = useLabels();
  const products = useMemo(
    () => (author.production ? toProducts(author.production) : []),
    [author.production],
  );
  const groups = orderedGroups(author);
  const ods = inheritOds(groups);
  const centers = author.centers ?? [];

  const [params, setParams] = useSearchParams();
  const tab: ProfileTab = params.get('tab') === 'produccion' ? 'produccion' : 'perfil';
  const setTab = (next: ProfileTab) => setParams(next === 'perfil' ? {} : { tab: next }, { replace: true });
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const showTypology = (typology: TypologyId) => {
    setFilters({ ...EMPTY_FILTERS, typology });
    setTab('produccion');
  };

  useDocumentMetadata({
    title: name,
    description: profileDescription(t, name, labels.researcher(author.category), author),
    path,
    type: 'profile',
    noindex: !isIndexable(author),
    image: author.photoUrl ?? undefined,
  });

  return (
    <article className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(profileJsonLd(author, name, path, groups, profiles)) }}
      />

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
              <Link to="/investigadores" className="hover:text-primary">
                {t('profile.breadcrumbDirectory')}
              </Link>
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
        {/* 1. Tarjeta principal del perfil y, a la derecha, perfiles académicos y ODS */}
        <div className="grid grid-cols-1 gap-gutter xl:grid-cols-12">
          <ProfileHero
            author={author}
            name={name}
            groups={groups}
            centers={centers}
            hasAside={profiles.length > 0 || ods.length > 0}
          />
          {profiles.length || ods.length ? <ProfileAside profiles={profiles} ods={ods} /> : null}
        </div>

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
          <ProfileIndicators
            metrics={author.metrics}
            products={products}
            citations={totalCitations(author.production)}
            onExploreTypology={showTypology}
          />
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
          to="/investigadores"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('profile.back')}
        </Link>
      </div>
    </article>
  );
}
