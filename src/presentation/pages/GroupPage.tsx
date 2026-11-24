import { useContext, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authorSlug, parseAuthorId, type Product, type TypologyId } from '@/domain/authors/author';
import type { GroupDetail } from '@/domain/groups/group';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { TabBar } from '@/presentation/components/ui/TabBar';
import {
  EMPTY_FILTERS,
  ProductsTable,
  type ProductFilters,
} from '@/presentation/components/authors/ProductsTable';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { GroupQueriesContext } from '@/presentation/hooks/use-groups';
import { safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';
import { GroupBreadcrumb, GroupHeader } from './group/GroupHeader';
import { GroupMembers } from './group/GroupMembers';
import { GroupOverview } from './group/GroupOverview';
import { GROUP_TABS, groupDescription, groupJsonLd, type GroupTab } from './group/group-model';
import { card } from './group/styles';
import { useGroupProduction } from './group/use-group-production';

function useGroupQueries() {
  const q = useContext(GroupQueriesContext);
  if (!q) throw new Error('GroupQueriesContext no está provisto');
  return q;
}

export function GroupPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const id = parseAuthorId(slug);
  const q = useGroupQueries();
  const { data, isError, error, refetch } = useQuery({ ...q.detail(id ?? 0), enabled: id !== null });
  const { t } = useTranslation(['groups', 'common', 'authors']);

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = authorSlug(data.group);
    if (slug !== canonical) return <Navigate replace to={`/grupos/${canonical}${search}`} />;
    return <GroupProfile group={data.group} />;
  }
  return (
    <div className="container-page py-16">
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div
          aria-busy="true"
          aria-label={t('detail.loading')}
          className="h-64 animate-pulse rounded-3xl bg-surface-container-lowest"
        />
      )}
    </div>
  );
}

function GroupProfile({ group }: { group: GroupDetail }) {
  const path = `/grupos/${authorSlug(group)}`;
  const { t } = useTranslation(['groups', 'common', 'authors']);
  const q = useGroupQueries();
  const members = useQuery(q.members(group.id));
  const [params, setParams] = useSearchParams();
  const tab = GROUP_TABS.find((x) => x === params.get('tab')) ?? 'perfil';
  const setTab = (next: GroupTab) => setParams(next === 'perfil' ? {} : { tab: next }, { replace: true });

  const { published, profiles, productionReady, products } = useGroupProduction(members);
  // Mismos filtros que la tabla de productos del investigador; una tarjeta de tipología la preselecciona.
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const showTypology = (typology: TypologyId) => {
    setFilters({ ...EMPTY_FILTERS, typology });
    setTab('produccion');
  };
  const productionHint = members.data
    ? t('detail.productionHint', { published: published.length, count: members.data.length })
    : t('common:loading');
  const lineNames = group.lines.map((l) => l.name);

  useDocumentMetadata({ title: group.name, description: groupDescription(t, group, lineNames), path });

  return (
    <article className="pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(groupJsonLd(group, path, lineNames)) }}
      />
      <GroupBreadcrumb code={group.code} />

      <div className="container-page mt-gutter flex flex-col gap-5">
        <GroupHeader group={group} />

        <TabBar
          label={t('detail.tabsLabel')}
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: 'perfil', label: t('detail.tabProfile'), icon: 'analytics' },
            { id: 'integrantes', label: t('detail.tabMembers'), icon: 'group', badge: members.data?.length },
            {
              id: 'produccion',
              label: t('detail.tabProduction'),
              icon: 'menu_book',
              badge: productionReady ? products.length : undefined,
            },
          ]}
        />

        {/* Perfil e indicadores */}
        <div id="panel-perfil" role="tabpanel" aria-labelledby="tab-perfil" hidden={tab !== 'perfil'}>
          <GroupOverview
            group={group}
            members={members.data}
            products={products}
            productionReady={productionReady}
            productionHint={productionHint}
            onExploreTypology={showTypology}
          />
        </div>

        {/* Integrantes */}
        <div
          id="panel-integrantes"
          role="tabpanel"
          aria-labelledby="tab-integrantes"
          hidden={tab !== 'integrantes'}
        >
          {members.isError ? (
            <ErrorState error={members.error} onRetry={() => members.refetch()} />
          ) : (
            <GroupMembers members={members.data} leader={group.leader} />
          )}
        </div>

        {/* Producción científica */}
        <div
          id="panel-produccion"
          role="tabpanel"
          aria-labelledby="tab-produccion"
          hidden={tab !== 'produccion'}
        >
          {profiles.isError ? (
            <ErrorState message={t('detail.productionError')} onRetry={profiles.refetch} />
          ) : productionReady ? (
            <GroupProduction
              products={products}
              filters={filters}
              onFiltersChange={setFilters}
              note={productionHint}
            />
          ) : (
            <div
              aria-busy="true"
              aria-label={t('detail.loadingProduction')}
              className={`${card} h-48 animate-pulse`}
            />
          )}
        </div>

        <Link
          to="/grupos"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('detail.back')}
        </Link>
      </div>
    </article>
  );
}

/** Producción del grupo: la misma tabla (filtros incluidos) que los productos del investigador. */
function GroupProduction({
  products,
  filters,
  onFiltersChange,
  note,
}: {
  products: Product[];
  filters: ProductFilters;
  onFiltersChange: (f: ProductFilters) => void;
  note: string;
}) {
  const { t } = useTranslation('groups');
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-headline-md font-semibold text-primary">{t('production.title')}</h2>
        <p className="text-body-sm text-on-surface-variant">
          {t('production.lead', { count: products.length, note })}
        </p>
      </div>
      <ProductsTable products={products} filters={filters} onFiltersChange={onFiltersChange} />
    </section>
  );
}
