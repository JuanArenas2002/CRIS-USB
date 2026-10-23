import { z } from 'zod';
import {
  QUARTILES,
  type PublicationPage,
  type PublicationRepository,
  type PublicationStats,
} from '@/domain/publications/publication';
import type { ApiGet } from '@/infrastructure/http/api-client';

// Contrato del BFF `/api/publications` y `/api/publications/stats` (ranking de /admin/produccion).
const quartile = z.enum(QUARTILES);

const publication = z.object({
  rank: z.number().int(),
  score: z.number(),
  eid: z.string(),
  doi: z.string().nullable(),
  title: z.string(),
  abstract: z.string().nullable(),
  year: z.number().int().nullable(),
  type: z.string().nullable(),
  journal: z.string().nullable(),
  issn: z.array(z.string()),
  language: z.string().nullable(),
  quartile: quartile.nullable(),
  areas: z.array(z.string()),
  citations: z.number().int(),
  openAccess: z.boolean(),
  international: z.boolean(),
  countries: z.array(z.string()),
  correspondence: z.boolean(),
  authorsCount: z.number().int().nullable(),
  authors: z.array(z.object({ id: z.number().int(), name: z.string(), published: z.boolean() })),
});

const pageSchema = z.object({
  items: z.array(publication.extend({ position: z.number().int() })),
  total: z.number().int(),
  page: z.number().int(),
  pages: z.number().int(),
}) as unknown as z.ZodType<PublicationPage>;

const statsSchema = z.object({
  total: z.number().int(),
  byQuartile: z.record(quartile, z.number().int()),
  openAccess: z.number().int(),
  international: z.number().int(),
  citations: z.number().int(),
  years: z.array(z.number().int()),
  types: z.array(z.string()),
  areas: z.array(z.string()),
}) as unknown as z.ZodType<PublicationStats>;

export function httpPublicationRepository(get: ApiGet): PublicationRepository {
  return {
    list(q, signal) {
      const params = new URLSearchParams({ page: String(q.page), size: String(q.pageSize) });
      if (q.search) params.set('q', q.search);
      if (q.yearFrom) params.set('from', String(q.yearFrom));
      if (q.yearTo) params.set('to', String(q.yearTo));
      if (q.quartile) params.set('quartile', q.quartile);
      if (q.type) params.set('type', q.type);
      if (q.area) params.set('area', q.area);
      if (q.openAccess) params.set('oa', '1');
      if (q.sort && q.sort !== 'rank') params.set('sort', q.sort);
      return get(`/api/publications?${params}`, pageSchema, signal);
    },
    stats: (signal) => get('/api/publications/stats', statsSchema, signal),
  };
}
