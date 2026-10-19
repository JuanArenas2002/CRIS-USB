import { queryOptions } from '@tanstack/react-query';
import { sortCenters, type CenterDetail, type CenterRepository } from '@/domain/centers/center';

export type PublicCenterDetail = { kind: 'found'; center: CenterDetail } | { kind: 'not-found' };

/** Regla de publicación (plantillacentro.html): activos e inactivos, estos como registro histórico. */
export const toPublicCenterDetail = (c: CenterDetail | null): PublicCenterDetail =>
  c ? { kind: 'found', center: c } : { kind: 'not-found' };

export function centerQueries(repo: CenterRepository) {
  return {
    list: () =>
      queryOptions({
        queryKey: ['centers', 'list'],
        queryFn: async ({ signal }) => sortCenters(await repo.list(signal)),
        staleTime: 10 * 60 * 1000,
      }),
    detail: (id: number) =>
      queryOptions({
        queryKey: ['centers', 'detail', id],
        queryFn: async ({ signal }) => toPublicCenterDetail(await repo.getById(id, signal)),
        staleTime: 10 * 60 * 1000,
      }),
  };
}

export type CenterQueries = ReturnType<typeof centerQueries>;
