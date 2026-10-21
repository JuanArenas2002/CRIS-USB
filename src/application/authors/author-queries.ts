import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import {
  externalProfiles,
  type Author,
  type AuthorCategoryId,
  type AuthorProfile,
} from '@/domain/authors/author';
import type { AuthorRepository } from '@/domain/authors/author-repository';

export const DIRECTORY_PAGE_SIZE = 12;
/** Máximo por página del BFF (MAX_PAGE_SIZE en scripts/public-api.ts). */
const ALL_PAGE_SIZE = 100;

export interface DirectoryFilters {
  search: string;
  category?: AuthorCategoryId;
  groupId?: number;
  centerId?: number;
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
              centerId: f.centerId,
              page: f.page,
              pageSize: DIRECTORY_PAGE_SIZE,
            },
            signal,
          ),
        placeholderData: keepPreviousData,
      }),
    /** Todos los publicados (los seleccionados en el ranking), página a página. Para el admin. */
    all: () =>
      queryOptions({
        queryKey: ['authors', 'all'],
        queryFn: async ({ signal }) => {
          const items: Author[] = [];
          for (let page = 1; ; page++) {
            const r = await repo.list({ page, pageSize: ALL_PAGE_SIZE }, signal);
            items.push(...r.items);
            if (page >= r.pages) return items;
          }
        },
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
      }),
    stats: () =>
      queryOptions({
        queryKey: ['authors', 'stats'],
        queryFn: ({ signal }) => repo.stats(signal),
      }),
  };
}

export type AuthorQueries = ReturnType<typeof authorQueries>;
