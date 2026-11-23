import { z } from 'zod';
import { createApiClient } from '@/infrastructure/http/api-client';
import type { OrcidProfile, OrcidSearchHit } from '@/domain/orcid/orcid';
import { BASE } from '@/shared/base';

/** Perfil público ORCID vía el BFF (/api/orcid/{orcid}); el navegador nunca llama a ORCID directamente. */
const affiliation = z.object({
  kind: z.enum(['employment', 'invited-position', 'education', 'qualification']),
  organization: z.string(),
  department: z.string().nullable(),
  role: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  current: z.boolean(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  orgId: z.object({ source: z.string(), value: z.string() }).nullable(),
  ror: z.string().nullable(),
  url: z.string().nullable(),
  source: z.string().nullable(),
  visibility: z.string().nullable(),
  putCode: z.number().nullable(),
});

const profileSchema: z.ZodType<OrcidProfile> = z.object({
  orcid: z.string(),
  uri: z.string(),
  givenName: z.string().nullable(),
  middleName: z.string().nullable(),
  familyName: z.string().nullable(),
  publishedName: z.string().nullable(),
  displayName: z.string(),
  biography: z.string().nullable(),
  country: z.string().nullable(),
  createdAt: z.string().nullable(),
  lastModifiedAt: z.string().nullable(),
  employments: z.array(affiliation),
  educations: z.array(affiliation),
});

const hitsSchema: z.ZodType<OrcidSearchHit[]> = z.array(
  z.object({ orcid: z.string(), name: z.string(), institutions: z.array(z.string()) }),
);

const get = createApiClient({ baseUrl: BASE });

export const orcidClient = {
  profile: (orcid: string, signal?: AbortSignal) =>
    get(`/api/orcid/${encodeURIComponent(orcid)}`, profileSchema, signal),
  /** Búsqueda por nombre (mínimo 3 letras). */
  search: (term: string, signal?: AbortSignal) =>
    get(`/api/orcid/search?q=${encodeURIComponent(term)}`, hitsSchema, signal),
};
