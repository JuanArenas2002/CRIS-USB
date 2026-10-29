import { z } from 'zod';
import type { CollaborationMap, CountryPublication, RelationsRepository } from '@/domain/relations/relations';
import type { ApiGet } from '@/infrastructure/http/api-client';

// Contrato del BFF `/api/relations/countries?year=` (proyección de scripts/collaboration-source.ts).
const mapSchema = z.object({
  year: z.number().int().nullable(),
  countries: z.array(
    z.object({
      iso2: z.string().regex(/^[A-Z]{2}$/),
      iso3: z.string(),
      isoNumeric: z.string().regex(/^\d{3}$/),
      country: z.string(),
      local: z.boolean(),
      publications: z.number(),
      citations: z.number(),
    }),
  ),
}) as unknown as z.ZodType<CollaborationMap>;

const publicationsSchema = z.array(
  z.object({
    eid: z.string(),
    title: z.string(),
    year: z.number().int().nullable(),
    doi: z.string().nullable(),
    journal: z.string().nullable(),
    docType: z.string().nullable(),
    citations: z.number(),
    quartile: z.string().nullable(),
    partners: z.array(z.string()),
  }),
) as unknown as z.ZodType<CountryPublication[]>;

const yearQs = (year: number | null) => (year ? `?year=${year}` : '');

export function httpRelationsRepository(get: ApiGet): RelationsRepository {
  return {
    countries: (year, signal) => get(`/api/relations/countries${yearQs(year)}`, mapSchema, signal),
    publications: (iso3, year, signal) =>
      get(`/api/relations/countries/${iso3}/publications${yearQs(year)}`, publicationsSchema, signal),
  };
}
