import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import {
  externalProfiles,
  type Author,
  type AuthorCategoryId,
  type AuthorProfile,
} from '@/domain/authors/author';
import type { AuthorRepository } from '@/domain/authors/author-repository';

export const DIRECTORY_PAGE_SIZE = 12;

export interface DirectoryFilters {
  search: string;
  category?: AuthorCategoryId;
  groupId?: number;
  page: number;
}

export type PublicProfile = { kind: 'found'; author: AuthorProfile } | { kind: 'not-found' };

/** El BFF ya publica solo investigadores activos en GrupLAC; null = no existe o no es público. */
export const toPublicProfile = (a: AuthorProfile | null): PublicProfile =>
  a ? { kind: 'found', author: a } : { kind: 'not-found' };

/** Sin identificadores externos el perfil es contenido escaso: se publica, pero no se indexa. */
export const isIndexable = (a: Author) => externalProfiles(a).length > 0;

/** Casos de uso de investigadores expresados como queries de TanStack Query (caché + cancelación). */
export function authorQueries(repo: AuthorRepository) {
  return {
    directory: (f: DirectoryFilters) =>
      queryOptions({
        queryKey: ['authors', 'directory', f],
        queryFn: ({ signal }) =>
          repo.list(
            {
              search: f.search.trim() || undefined,
              category: f.category,
              groupId: f.groupId,
              page: f.page,
              pageSize: DIRECTORY_PAGE_SIZE,
            },
            signal,
          ),
        placeholderData: keepPreviousData,
      }),
    profile: (id: number) =>
      queryOptions({
        queryKey: ['authors', 'profile', id],
        queryFn: async ({ signal }) => toPublicProfile(await repo.getById(id, signal)),
      }),
    featured: () =>
      queryOptions({
        queryKey: ['authors', 'featured'],
        queryFn: ({ signal }) => repo.featured(signal),
        staleTime: 10 * 60 * 1000,
      }),
    stats: () =>
      queryOptions({
        queryKey: ['authors', 'stats'],
        queryFn: ({ signal }) => repo.stats(signal),
        staleTime: 10 * 60 * 1000,
      }),
  };
}

export type AuthorQueries = ReturnType<typeof authorQueries>;
