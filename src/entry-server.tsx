import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { dehydrate, type QueryClient } from '@tanstack/react-query';
import { AppProviders, AppRoutes, createQueryClient } from '@/app/App';
import {
  authorQueries,
  isIndexable,
  toPublicProfile,
  type AuthorQueries,
} from '@/application/authors/author-queries';
import {
  authorSlug,
  authorStats,
  featuredAuthors,
  withRankingCenter,
  queryAuthors,
  type Author,
  type AuthorProfile,
} from '@/domain/authors/author';
import { centerQueries, type CenterQueries } from '@/application/centers/center-queries';
import { groupQueries, type GroupQueries } from '@/application/groups/group-queries';
import { summarizeCenter, type CenterDetail } from '@/domain/centers/center';
import { hasPublicDetail, summarizeGroup, type GroupDetail, type GroupMember } from '@/domain/groups/group';
import { NAV_ITEMS } from '@/shared/navigation';
import { headTags, titleTag, safeJson, type PageMeta } from '@/shared/seo';

/** Investigadores ya proyectados por scripts/investigators-source.ts (sin datos personales). */
export function createServerAuthorQueries(authors: AuthorProfile[]): AuthorQueries {
  // Listado y destacados: solo lo de la tarjeta, como la API. Con la producción completa, la
  // portada embebía ~900 KB de datos que la tarjeta no usa (solo el perfil los necesita).
  const cards: Author[] = authors.map(({ production: _p, groups: _g, ...card }) => card);
  return authorQueries({
    list: async (q) => queryAuthors(cards, q),
    getById: async (id) => authors.find((a) => a.id === id) ?? null,
    stats: async () => authorStats(cards),
    featured: async () => featuredAuthors(cards),
  });
}

/** Grupos ya proyectados por scripts/groups-source.ts (sin datos personales). */
export function createServerGroupQueries(
  groups: GroupDetail[],
  members: Map<number, GroupMember[]> = new Map(),
): GroupQueries {
  return groupQueries({
    members: async (id) => members.get(id) ?? [],
    list: async () => groups.map(summarizeGroup),
    getById: async (id) => groups.find((g) => g.id === id) ?? null,
  });
}

/** Centros ya proyectados por scripts/centers-source.ts (sin datos personales). */
export function createServerCenterQueries(centers: CenterDetail[]): CenterQueries {
  return centerQueries({
    list: async () => centers.map(summarizeCenter),
    getById: async (id) => centers.find((c) => c.id === id) ?? null,
  });
}

export function render(
  url: string,
  queryClient: QueryClient,
  queries: AuthorQueries,
  groups: GroupQueries,
  centers: CenterQueries,
) {
  const head: { meta?: PageMeta } = {};
  const html = renderToString(
    <AppProviders
      queryClient={queryClient}
      queries={queries}
      groups={groups}
      centers={centers}
      onHead={(m) => (head.meta = m)}
    >
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </AppProviders>,
  );
  const { meta } = head;
  if (!meta) throw new Error(`La ruta ${url} no declaró metadatos`);
  const state = { path: url, queries: dehydrate(queryClient) };
  return {
    html,
    head: `${titleTag(meta)}\n    ${headTags(meta)}\n    <script>window.__CRIS__=${safeJson(state)}</script>`,
    meta,
  };
}

export {
  NAV_ITEMS,
  authorSlug,
  createQueryClient,
  hasPublicDetail,
  isIndexable,
  toPublicProfile,
  withRankingCenter,
};
