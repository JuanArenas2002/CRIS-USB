import { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { PublicationFilters, PublicationQueries } from '@/application/publications/publication-queries';
import {
  PUBLICATION_SORTS,
  QUARTILES,
  type PublicationSort,
  type Quartile,
} from '@/domain/publications/publication';
import { useDebounce } from './use-debounce';

export const PublicationQueriesContext = createContext<PublicationQueries | null>(null);

function usePublicationQueries() {
  const q = useContext(PublicationQueriesContext);
  if (!q) throw new Error('PublicationQueriesContext no está provisto');
  return q;
}

export const usePublications = (f: PublicationFilters) => useQuery(usePublicationQueries().list(f));
export const usePublicationStats = () => useQuery(usePublicationQueries().stats());

/** Filtros de /productos en la URL (?q=&desde=&hasta=&cuartil=&tipo=&area=&oa=&orden=&page=). */
export function usePublicationSearch() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const quartileParam = params.get('cuartil');
  const sortParam = params.get('orden');
  const filters: PublicationFilters = {
    search: q,
    yearFrom: Number(params.get('desde')) || undefined,
    yearTo: Number(params.get('hasta')) || undefined,
    quartile: QUARTILES.includes(quartileParam as Quartile) ? (quartileParam as Quartile) : undefined,
    type: params.get('tipo') || undefined,
    area: params.get('area') || undefined,
    openAccess: params.get('oa') === '1' || undefined,
    sort: PUBLICATION_SORTS.includes(sortParam as PublicationSort) ? (sortParam as PublicationSort) : 'rank',
    page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
  };

  const [term, setTerm] = useState(q);
  const debouncedTerm = useDebounce(term);

  /** Cambiar un filtro vuelve a la primera página. */
  const set = (k: string, v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        next.delete('page');
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if (debouncedTerm.trim() !== q) set('q', debouncedTerm.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al texto escrito
  }, [debouncedTerm]);

  return {
    term,
    setTerm,
    filters,
    set,
    hasActiveFilters: Boolean(
      q ||
      filters.yearFrom ||
      filters.yearTo ||
      filters.quartile ||
      filters.type ||
      filters.area ||
      filters.openAccess,
    ),
    isFiltered: params.size > 0,
    reset: () => {
      setTerm('');
      setParams(filters.sort === 'rank' ? {} : { orden: filters.sort! }, { replace: true });
    },
  };
}
