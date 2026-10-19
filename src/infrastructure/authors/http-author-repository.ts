import { z } from 'zod';
import {
  AUTHOR_CATEGORIES,
  type Author,
  type AuthorProfile,
  type AuthorStats,
} from '@/domain/authors/author';
import type { AuthorRepository } from '@/domain/authors/author-repository';
import { ApiError, type ApiGet } from '@/infrastructure/http/api-client';

// Contrato del BFF `/api/investigators*` (proyección pública de scripts/investigators-source.ts).
const categoryId = z.enum(AUTHOR_CATEGORIES.map((c) => c.id) as [string, ...string[]]);
const httpsUrl = z.url({ protocol: /^https$/ }).nullable();
const groupRef = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable().optional(),
  ods: z.array(z.number().int().min(1).max(17)).optional(),
  type: z.string().nullable().optional(),
});

const author = {
  id: z.number().int(),
  name: z.string(),
  category: categoryId.nullable(),
  degree: z.string().nullable(),
  orcid: z.string().nullable(),
  scopusId: z.string().nullable(),
  cvlacUrl: httpsUrl,
  scholarUrl: httpsUrl,
  mainGroup: groupRef.nullable(),
  photoUrl: z.string().startsWith('/api/investigators/').nullable(),
  metrics: z
    .object({
      hIndex: z.number().int().nullable(),
      scopusPublications: z.number().int(),
      products: z.number().int(),
    })
    .nullable(),
};
const year = z.number().int().nullable();
const production = z
  .object({
    publications: z.array(
      z.object({
        id: z.number().int(),
        title: z.string(),
        year,
        journal: z.string().nullable(),
        type: z.string().nullable(),
        citedBy: z.number().int(),
        doi: z.string().nullable(),
        url: httpsUrl,
        authors: z.string().nullable(),
      }),
    ),
    theses: z.array(
      z.object({
        id: z.number().int(),
        title: z.string(),
        year,
        level: z.string().nullable(),
        program: z.string().nullable(),
        url: httpsUrl,
        authors: z.string().nullable(),
      }),
    ),
    developments: z.array(
      z.object({
        id: z.number().int(),
        title: z.string(),
        year,
        kind: z.string().nullable(),
        company: z.string().nullable(),
      }),
    ),
  })
  .nullable();
export const authorFields = author;
const authorSchema = z.object(author) as unknown as z.ZodType<Author>;
const profileSchema = z.object({
  ...author,
  groups: z.array(groupRef),
  centers: z
    .array(
      z.object({
        id: z.number().int(),
        code: z.string(),
        acronym: z.string().nullable(),
        name: z.string(),
        logoUrl: z.string().nullable().default(null),
      }),
    )
    .default([]),
  production,
}) as unknown as z.ZodType<AuthorProfile>;

const pageSchema = z.object({
  items: z.array(authorSchema),
  total: z.number().int(),
  page: z.number().int(),
  pages: z.number().int(),
});

const statsSchema = z.object({
  total: z.number().int(),
  byCategory: z.record(categoryId, z.number().int()),
}) as unknown as z.ZodType<AuthorStats>;

export function httpAuthorRepository(get: ApiGet): AuthorRepository {
  return {
    list(q, signal) {
      const params = new URLSearchParams({ page: String(q.page), size: String(q.pageSize) });
      if (q.search) params.set('q', q.search);
      if (q.category) params.set('cat', q.category);
      if (q.groupId) params.set('group', String(q.groupId));
      return get(`/api/investigators?${params}`, pageSchema, signal);
    },
    async getById(id, signal) {
      try {
        return await get(`/api/investigators/${id}`, profileSchema, signal);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    stats: (signal) => get('/api/investigators/stats', statsSchema, signal),
    featured: (signal) => get('/api/investigators/featured', z.array(authorSchema), signal),
  };
}
