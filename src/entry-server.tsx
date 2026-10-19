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
  queryAuthors,
  type AuthorProfile,
} from '@/domain/authors/author';
import { groupQueries, type GroupQueries } from '@/application/groups/group-queries';
import { summarizeGroup, type GroupDetail, type GroupMember } from '@/domain/groups/group';
import { NAV_ITEMS } from '@/shared/navigation';
import { headTags, titleTag, safeJson, type PageMeta } from '@/shared/seo';

/** Investigadores ya proyectados por scripts/investigators-source.ts (sin datos personales). */
export function createServerAuthorQueries(authors: AuthorProfile[]): AuthorQueries {
  return authorQueries({
    list: async (q) => queryAuthors(authors, q),
    getById: async (id) => authors.find((a) => a.id === id) ?? null,
    stats: async () => authorStats(authors),
    featured: async () => featuredAuthors(authors),
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

export function render(url: string, queryClient: QueryClient, queries: AuthorQueries, groups: GroupQueries) {
  const head: { meta?: PageMeta } = {};
  const html = renderToString(
    <AppProviders queryClient={queryClient} queries={queries} groups={groups} onHead={(m) => (head.meta = m)}>
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

export { NAV_ITEMS, authorSlug, createQueryClient, isIndexable, toPublicProfile };
