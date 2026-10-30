import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RelationQueries } from '@/application/relations/relation-queries';

export const RelationQueriesContext = createContext<RelationQueries | null>(null);

function useRelationQueries() {
  const q = useContext(RelationQueriesContext);
  if (!q) throw new Error('RelationQueriesContext no está provisto');
  return q;
}

export const useCollaborationMap = (year: number | null) => useQuery(useRelationQueries().countries(year));

/** Publicaciones con el país seleccionado (nada se pide si no hay país). */
export function useCountryPublications(iso3: string | null, year: number | null) {
  const q = useRelationQueries();
  return useQuery({ ...q.publications(iso3 ?? '', year), enabled: !!iso3 });
}
