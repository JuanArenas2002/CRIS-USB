import { queryOptions } from '@tanstack/react-query';
import { hasPublicDetail, sortGroups, type GroupDetail, type GroupRepository } from '@/domain/groups/group';

export type PublicGroupDetail = { kind: 'found'; group: GroupDetail } | { kind: 'not-found' };

/** Regla de publicación: solo grupos activos y con ficha pública (no interinstitucionales). */
export const toPublicGroupDetail = (g: GroupDetail | null): PublicGroupDetail =>
  g && g.active && hasPublicDetail(g) ? { kind: 'found', group: g } : { kind: 'not-found' };

/** Solo grupos activos y ordenados por categoría: es lo que el portal publica. */
export function groupQueries(repo: GroupRepository) {
  return {
    list: () =>
      queryOptions({
        queryKey: ['groups', 'list'],
        queryFn: async ({ signal }) => sortGroups((await repo.list(signal)).filter((g) => g.active)),
      }),
    members: (id: number) =>
      queryOptions({
        queryKey: ['groups', 'members', id],
        queryFn: ({ signal }) => repo.members(id, signal),
      }),
    detail: (id: number) =>
      queryOptions({
        queryKey: ['groups', 'detail', id],
        queryFn: async ({ signal }) => toPublicGroupDetail(await repo.getById(id, signal)),
      }),
  };
}

export type GroupQueries = ReturnType<typeof groupQueries>;
