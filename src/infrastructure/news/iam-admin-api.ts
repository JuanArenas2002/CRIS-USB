import { z } from 'zod';
import { permissionsSchema, userSchema } from '@/infrastructure/news/news-auth';
import { call, empty, qs } from '@/infrastructure/news/news-http';

/** Administración del IAM: usuarios, roles, permisos, asignaciones, sesiones y auditoría. */

const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), total: z.number(), limit: z.number(), offset: z.number() });

export const adminUserSchema = userSchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
  locked_until: z.string().nullable(),
  linked_identities: z.array(
    z.object({
      id: z.number(),
      provider: z.string(),
      tenant_id: z.string(),
      email_at_link: z.string().nullable(),
      linked_at: z.string(),
      last_used_at: z.string().nullable(),
    }),
  ),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

const assignmentSchema = z.object({
  id: z.number(),
  role: z.string(),
  role_name: z.string(),
  scope_type: z.string().nullable(),
  scope_id: z.number().nullable(),
  assigned_by: z.number().nullable(),
  assigned_at: z.string(),
  revoked_at: z.string().nullable(),
  revoked_by: z.number().nullable(),
  revoke_reason: z.string().nullable(),
  is_active: z.boolean(),
});
export type Assignment = z.infer<typeof assignmentSchema>;

const sessionSchema = z.object({
  id: z.number(),
  method: z.string(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: z.string(),
  last_seen_at: z.string(),
  expires_at: z.string(),
});
export type UserSession = z.infer<typeof sessionSchema>;

export const roleSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  permissions: z.array(z.string()),
  permission_names: z.record(z.string(), z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  module: z.string(),
  resource: z.string(),
  action: z.string(),
  is_active: z.boolean(),
});
export type Permission = z.infer<typeof permissionSchema>;

const auditSchema = z.object({
  id: z.number(),
  actor_user_id: z.number().nullable(),
  actor_name: z.string().nullable().optional(),
  event_type: z.string(),
  result: z.string(),
  resource_type: z.string().nullable(),
  resource_id: z.string().nullable(),
  ip: z.string().nullable(),
  context: z.record(z.string(), z.unknown()).nullable(),
  at: z.string(),
});
export type AuditEntry = z.infer<typeof auditSchema>;

const message = z.object({ detail: z.string() });
type Params = Record<string, string | number | boolean | undefined>;

export const iamAdmin = {
  // usuarios
  users: (f: Params) => call(`/users${qs(f)}`, page(adminUserSchema)),
  user: (id: number) => call(`/users/${id}`, adminUserSchema),
  createUser: (body: { email: string; first_name: string; last_name: string; account_type: string; password: string }) =>
    call('/users', adminUserSchema, { method: 'POST', body }),
  setPassword: (id: number, password: string) =>
    call(`/users/${id}/password`, adminUserSchema, { method: 'POST', body: { password } }),
  updateUser: (
    id: number,
    body: Partial<{ first_name: string; last_name: string; email: string; account_type: string }>,
  ) => call(`/users/${id}`, adminUserSchema, { method: 'PATCH', body }),
  deleteUser: (id: number) => call(`/users/${id}`, empty, { method: 'DELETE' }),
  userStatus: (id: number, action: 'activate' | 'deactivate' | 'block' | 'unblock', reason?: string) =>
    call(`/users/${id}/${action}`, adminUserSchema, { method: 'POST', body: { reason: reason || null } }),
  unlock: (id: number) => call(`/users/${id}/unlock`, adminUserSchema, { method: 'POST' }),
  sessions: (id: number) => call(`/users/${id}/sessions`, z.array(sessionSchema)),
  revokeSession: (id: number, sessionId: number) =>
    call(`/users/${id}/sessions/${sessionId}`, empty, { method: 'DELETE' }),
  requestMicrosoftLink: (id: number) =>
    call(`/users/${id}/identities/microsoft/link-request`, message, { method: 'POST' }),
  unlinkIdentity: (id: number, identityId: number) =>
    call(`/users/${id}/identities/${identityId}`, empty, { method: 'DELETE' }),
  roles: (id: number) => call(`/users/${id}/roles`, z.array(assignmentSchema)),
  roleHistory: (id: number) => call(`/users/${id}/role-assignments`, z.array(assignmentSchema)),
  assignRole: (id: number, body: { role: string; scope_type: string | null; scope_id: number | null }) =>
    call(`/users/${id}/roles`, assignmentSchema, { method: 'POST', body }),
  revokeRole: (id: number, assignmentId: number, reason?: string) =>
    call(`/users/${id}/roles/${assignmentId}`, assignmentSchema, {
      method: 'DELETE',
      body: { reason: reason || null },
    }),
  userPermissions: (id: number) => call(`/users/${id}/permissions`, permissionsSchema),
  activity: (id: number, f: Params) => call(`/users/${id}/activity${qs(f)}`, page(auditSchema)),

  // roles
  listRoles: (f: Params = {}) => call(`/roles${qs({ limit: 100, ...f })}`, page(roleSchema)),
  createRole: (body: { code: string; name: string; description?: string | null; permissions: string[] }) =>
    call('/roles', roleSchema, { method: 'POST', body }),
  updateRole: (id: number, body: Partial<{ name: string; description: string | null; is_active: boolean }>) =>
    call(`/roles/${id}`, roleSchema, { method: 'PATCH', body }),
  deleteRole: (id: number) => call(`/roles/${id}`, empty, { method: 'DELETE' }),
  setRolePermissions: (id: number, permissions: string[]) =>
    call(`/roles/${id}/permissions`, roleSchema, { method: 'PUT', body: { permissions } }),

  // permisos
  listPermissions: (f: Params = {}) =>
    call(`/permissions${qs({ limit: 100, ...f })}`, page(permissionSchema)),
  createPermission: (body: Omit<Permission, 'id' | 'is_active'>) =>
    call('/permissions', permissionSchema, { method: 'POST', body }),
  updatePermission: (
    id: number,
    body: Partial<{ name: string; description: string | null; is_active: boolean }>,
  ) => call(`/permissions/${id}`, permissionSchema, { method: 'PATCH', body }),

  // auditoría
  audit: (f: Params) => call(`/audit${qs(f)}`, page(auditSchema)),
};
