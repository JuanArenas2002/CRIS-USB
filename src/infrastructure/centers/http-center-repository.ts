import { z } from 'zod';
import type { Center, CenterDetail, CenterRepository } from '@/domain/centers/center';
import { ApiError, type ApiGet } from '@/infrastructure/http/api-client';

// Contrato del BFF `/api/centers` y `/api/centers/{id}` (proyección pública de scripts/centers-source.ts).
const httpsUrl = z.url({ protocol: /^https$/ }).nullable();
const info = {
  id: z.number().int(),
  code: z.string(),
  acronym: z.string().nullable(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
  city: z.string().nullable(),
  department: z.string().nullable(),
  daneCode: z.string().nullable(),
  director: z
    .object({
      name: z.string(),
      orcid: z.string().nullable(),
      cvlacUrl: httpsUrl,
      scholarUrl: httpsUrl,
      scopusId: z.string().nullable(),
    })
    .nullable(),
  ods: z.array(z.number().int().min(1).max(17)),
  linesCount: z.number().int(),
};

const centerSchema = z.object(info) as unknown as z.ZodType<Center>;

const detailSchema = z.object({
  ...info,
  lines: z.array(z.object({ id: z.number().int(), code: z.string().nullable(), name: z.string() })),
  resolutions: z.array(
    z.object({
      id: z.number().int(),
      number: z.string().nullable(),
      type: z.string().nullable(),
      date: z.string().nullable(),
      description: z.string().nullable(),
      hasFile: z.boolean(),
    }),
  ),
}) as unknown as z.ZodType<CenterDetail>;

export function httpCenterRepository(get: ApiGet): CenterRepository {
  return {
    list: (signal) => get('/api/centers', z.array(centerSchema), signal),
    async getById(id, signal) {
      try {
        return await get(`/api/centers/${id}`, detailSchema, signal);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  };
}
