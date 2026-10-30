import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { RelationsRepository } from '@/domain/relations/relations';

export function relationQueries(repo: RelationsRepository) {
  return {
    countries: (year: number | null) =>
      queryOptions({
        queryKey: ['relations', 'countries', year],
        queryFn: ({ signal }) => repo.countries(year, signal),
        // Al cambiar de año el mapa anterior queda visible (atenuado) hasta que llega el nuevo.
        placeholderData: keepPreviousData,
      }),
    publications: (iso3: string, year: number | null) =>
      queryOptions({
        queryKey: ['relations', 'publications', iso3, year],
        queryFn: ({ signal }) => repo.publications(iso3, year, signal),
      }),
  };
}

export type RelationQueries = ReturnType<typeof relationQueries>;
