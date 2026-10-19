import type { Author, AuthorListPage, AuthorListQuery, AuthorProfile, AuthorStats } from './author';

export type { AuthorListPage, AuthorListQuery };

/** Puerto: lo implementa infraestructura (HTTP), lo consumen los casos de uso. */
export interface AuthorRepository {
  list(query: AuthorListQuery, signal?: AbortSignal): Promise<AuthorListPage>;
  /** null si no existe o no es público. */
  getById(id: number, signal?: AbortSignal): Promise<AuthorProfile | null>;
  stats(signal?: AbortSignal): Promise<AuthorStats>;
  /** Investigadores destacados (seleccionados en Metri-K), con métricas. */
  featured(signal?: AbortSignal): Promise<Author[]>;
}
