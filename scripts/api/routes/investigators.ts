// Investigadores (públicos): listado con filtros, estadísticas, destacados y perfil. Las fotos están en images.ts.
import {
  AUTHOR_CATEGORIES,
  authorStats,
  featuredAuthors,
  isRankingTier,
  queryAuthors,
  type AuthorCategoryId,
  type RankingTier,
} from '../../../src/domain/authors/author.ts';
import { pageParams } from '../http.ts';
import type { Route } from '../router.ts';

const listInvestigators: Route = {
  match: /^\/api\/investigators$/,
  async handler({ ctx, sp, send }) {
    const cat = sp.get('cat');
    return send(
      200,
      queryAuthors(await ctx.investigators(), {
        search: sp.get('q') ?? undefined,
        category: AUTHOR_CATEGORIES.some((c) => c.id === cat) ? (cat as AuthorCategoryId) : undefined,
        groupId: Number(sp.get('group')) || undefined,
        centerId: Number(sp.get('center')) || undefined,
        tier: isRankingTier(sp.get('tier')) ? (sp.get('tier') as RankingTier) : undefined,
        ...pageParams(sp, 12),
      }),
    );
  },
};

const investigatorStats: Route = {
  match: /^\/api\/investigators\/stats$/,
  async handler({ ctx, send }) {
    return send(200, authorStats(await ctx.investigators()));
  },
};

const investigatorsFeatured: Route = {
  match: /^\/api\/investigators\/featured$/,
  async handler({ ctx, send }) {
    return send(200, featuredAuthors(await ctx.investigators()));
  },
};

const investigatorProfile: Route = {
  match: /^\/api\/investigators\/(\d{1,12})$/,
  async handler({ ctx, send }, m) {
    const { production } = await ctx.directory();
    const a = (await ctx.investigators()).find((x) => x.id === Number(m[1]));
    if (!a) return send(404, { detail: 'No encontrado' });
    // Cada grupo lleva sus ODS (Metri-K): el perfil muestra los que el investigador hereda.
    const byId = new Map((await ctx.metrikGroups()).map((x) => [x.id, x]));
    const groups = (await ctx.groupsOf(a.id)).map((g) => ({
      ...g,
      ods: byId.get(g.id)?.ods ?? [],
      type: byId.get(g.id)?.type ?? null,
    }));
    return send(200, { ...a, groups, production: production.get(a.id) ?? null });
  },
};

export const investigatorRoutes = [
  listInvestigators,
  investigatorStats,
  investigatorsFeatured,
  investigatorProfile,
];
