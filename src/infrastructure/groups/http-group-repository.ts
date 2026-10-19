import { z } from 'zod';
import type { Group, GroupDetail, GroupMember, GroupRepository } from '@/domain/groups/group';
import type { OdsId } from '@/domain/ods/ods';
import { authorFields } from '@/infrastructure/authors/http-author-repository';
import { ApiError, type ApiGet } from '@/infrastructure/http/api-client';

// Contrato del BFF `/api/groups` y `/api/groups/{id}` (proyección pública de scripts/groups-source.ts).
const httpsUrl = z.url({ protocol: /^https$/ }).nullable();
const info = {
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
  type: z.string().nullable(),
  category: z.string().nullable(),
  gruplacUrl: httpsUrl,
  city: z.string().nullable(),
  department: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
  leader: z
    .object({
      name: z.string(),
      orcid: z.string().nullable(),
      cvlacUrl: httpsUrl,
      scholarUrl: httpsUrl,
      scopusId: z.string().nullable(),
    })
    .nullable(),
  ods: z.array(z.number().int().min(1).max(17)) as unknown as z.ZodType<OdsId[]>,
};

const groupSchema: z.ZodType<Group> = z.object({
  ...info,
  lines: z.array(z.object({ id: z.number().int(), name: z.string() })),
});

const detailSchema: z.ZodType<GroupDetail> = z.object({
  ...info,
  lines: z.array(
    z.object({
      id: z.number().int(),
      code: z.string().nullable(),
      name: z.string(),
      objective: z.string().nullable(),
      achievements: z.string().nullable(),
      impact: z.string().nullable(),
    }),
  ),
  categoryHistory: z.array(
    z.object({ convocation: z.string(), year: z.number().int().nullable(), category: z.string() }),
  ),
});

const memberSchema = z.object({
  ...authorFields,
  profilePublished: z.boolean(),
}) as unknown as z.ZodType<GroupMember>;

export function httpGroupRepository(get: ApiGet): GroupRepository {
  return {
    members: (id, signal) => get(`/api/groups/${id}/members`, z.array(memberSchema), signal),
    list: (signal) => get('/api/groups', z.array(groupSchema), signal),
    async getById(id, signal) {
      try {
        return await get(`/api/groups/${id}`, detailSchema, signal);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  };
}
