import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type {
  PublicationFilter,
  PublicationQuery,
  PublicationRepository,
} from '@/domain/publications/publication';

export const PUBLICATIONS_PAGE_SIZE = 20;

export type PublicationFilters = Omit<PublicationQuery, 'pageSize'>;

/** Ranking de publicaciones (/productos) como queries de TanStack Query. */
export function publicationQueries(repo: PublicationRepository) {
  return {
    list: (f: PublicationFilters) =>
      queryOptions({
        queryKey: ['publications', 'list', f],
        queryFn: ({ signal }) =>
          repo.list(
            { ...f, search: f.search?.trim() || undefined, pageSize: PUBLICATIONS_PAGE_SIZE },
            signal,
          ),
        placeholderData: keepPreviousData,
      }),
    /** Conteo por año con los mismos filtros de la lista (sin orden ni página). */
    byYear: (f: PublicationFilters) => {
      const filter: PublicationFilter = {
        search: f.search?.trim() || undefined,
        yearFrom: f.yearFrom,
        yearTo: f.yearTo,
        type: f.type,
        area: f.area,
        openAccess: f.openAccess,
      };
      return queryOptions({
        queryKey: ['publications', 'by-year', filter],
        queryFn: ({ signal }) => repo.byYear(filter, signal),
        placeholderData: keepPreviousData,
      });
    },
    stats: () =>
      queryOptions({
        queryKey: ['publications', 'stats'],
        queryFn: ({ signal }) => repo.stats(signal),
      }),
  };
}

export type PublicationQueries = ReturnType<typeof publicationQueries>;
