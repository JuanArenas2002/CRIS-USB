import { z } from 'zod';
import type { Project, ProjectRepository } from '@/domain/projects/project';
import { ApiError, type ApiGet } from '@/infrastructure/http/api-client';

// Contrato del BFF `/api/projects` y `/api/projects/{id}` (proyección pública de scripts/projects-source.ts).
const text = z.string().nullable();
const projectSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  title: z.string(),
  centers: z.array(z.string()),
  groups: z.array(z.string()),
  area: text,
  year: z.number().int().nullable(),
  startYear: z.number().int().nullable(),
  endYear: z.number().int().nullable(),
  status: text,
  funder: text,
  allies: text,
  resources: text,
  territory: text,
  problem: text,
  solution: text,
  objective: text,
  results: text,
  beneficiaries: text,
  evidence: text,
  ods: z.array(z.number().int().min(1).max(17)),
  leaders: z.array(z.string()),
  photoUrl: z.string().nullable(),
  gallery: z.array(z.object({ slot: z.number().int(), url: z.string() })),
  products: z.array(
    z.object({
      title: z.string(),
      type: text,
      subtype: text,
      year: z.number().int().nullable(),
      status: text,
      url: z.url({ protocol: /^https?$/ }).nullable(),
    }),
  ),
}) as unknown as z.ZodType<Project>;

export function httpProjectRepository(get: ApiGet): ProjectRepository {
  return {
    list: (signal) => get('/api/projects', z.array(projectSchema), signal),
    async getById(id, signal) {
      try {
        return await get(`/api/projects/${id}`, projectSchema, signal);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  };
}
