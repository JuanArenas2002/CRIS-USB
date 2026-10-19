import { createContext, useContext } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { AuthorQueries, DirectoryFilters } from '@/application/authors/author-queries';

/** Inyección del caso de uso: el navegador, el prerender y los tests proveen su propio repositorio. */
export const AuthorQueriesContext = createContext<AuthorQueries | null>(null);

function useAuthorQueries(): AuthorQueries {
  const q = useContext(AuthorQueriesContext);
  if (!q) throw new Error('AuthorQueriesContext no está provisto');
  return q;
}

export const useAuthors = (filters: DirectoryFilters) => useQuery(useAuthorQueries().directory(filters));

export const useAuthorStats = () => useQuery(useAuthorQueries().stats());

export const useFeaturedAuthors = () => useQuery(useAuthorQueries().featured());

export function useAuthor(id: number | null) {
  const q = useAuthorQueries();
  return useQuery({ ...q.profile(id ?? 0), enabled: id !== null });
}

/** Perfiles de varios investigadores en paralelo (p. ej. los integrantes publicados de un grupo). */
export function useAuthorProfiles(ids: number[]) {
  const q = useAuthorQueries();
  return useQueries({
    queries: ids.map((id) => q.profile(id)),
    // `combine` se memoiza: `data` conserva su identidad mientras ningún perfil cambie.
    combine: (rs) => ({
      data: rs.map((r) => r.data),
      isSuccess: rs.every((r) => r.isSuccess),
      isError: rs.some((r) => r.isError),
      refetch: () => rs.forEach((r) => r.isError && void r.refetch()),
    }),
  });
}
