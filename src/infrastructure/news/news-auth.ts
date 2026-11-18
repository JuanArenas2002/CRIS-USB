import { z } from 'zod';
import { ApiError } from '@/infrastructure/http/api-client';
import { NEWS_API, call, qs, setCsrf } from '@/infrastructure/news/news-http';

/** Autenticación del IAM: sesión, contraseña, invitaciones, verificación y Microsoft. */

const identitySchema = z.object({
  provider: z.string(),
  tenant_id: z.string(),
  linked_at: z.string(),
  last_used_at: z.string().nullable(),
});

export const userSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  status: z.string(),
  account_type: z.string(),
  email_verified: z.boolean(),
  last_login_at: z.string().nullable(),
  auth_methods: z.array(z.string()),
  identities: z.array(identitySchema),
  must_change_password: z.boolean(),
  session: z
    .object({ id: z.number(), method: z.string(), created_at: z.string(), expires_at: z.string() })
    .nullable()
    .optional(),
});
export type NewsUser = z.infer<typeof userSchema>;

export const grantSchema = z.object({
  permission: z.string(),
  permission_name: z.string(),
  scope_type: z.string().nullable(),
  scope_id: z.number().nullable(),
});
export const permissionsSchema = z.object({
  permissions: z.array(z.string()),
  grants: z.array(grantSchema),
  names: z.record(z.string(), z.string()), // código -> nombre legible
});
export type NewsPermissions = z.infer<typeof permissionsSchema>;

const message = z.object({ detail: z.string() });
const providersSchema = z.object({ password: z.boolean(), microsoft: z.boolean() });
const loginSchema = z.object({ user: userSchema, csrf_token: z.string() });

export const newsAuth = {
  providers: () => call('/auth/providers', providersSchema),

  /** Usuario de la sesión actual, o null si no hay sesión. */
  async me(): Promise<NewsUser | null> {
    try {
      return await call('/auth/me', userSchema);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  permissions: () => call('/auth/me/permissions', permissionsSchema),

  async login(email: string, password: string): Promise<NewsUser> {
    const r = await call('/auth/login', loginSchema, { method: 'POST', body: { email, password } });
    setCsrf(r.csrf_token);
    return r.user;
  },

  /** Devuelve la URL de cierre federado de Microsoft (si la sesión fue con Microsoft). */
  async logout(): Promise<string | null> {
    try {
      const r = await call('/auth/logout', z.object({ federated_logout_url: z.string().nullable() }), {
        method: 'POST',
      });
      return r.federated_logout_url;
    } finally {
      setCsrf('');
    }
  },

  forgotPassword: (email: string) =>
    call('/auth/forgot-password', message, { method: 'POST', body: { email } }),
  resetPassword: (token: string, new_password: string) =>
    call('/auth/reset-password', message, { method: 'POST', body: { token, new_password } }),
  acceptInvitation: (token: string, password: string) =>
    call('/auth/register', userSchema, { method: 'POST', body: { token, password } }),
  verifyEmail: (token: string) => call('/auth/verify-email', message, { method: 'POST', body: { token } }),
  changePassword: (current_password: string, new_password: string) =>
    call('/auth/change-password', message, { method: 'POST', body: { current_password, new_password } }),

  /** Navegación completa (no fetch): el backend redirige a Microsoft y vuelve a `next`. */
  microsoftLoginUrl: (
    next: string,
    extra: { invitation?: string; link?: boolean; link_token?: string } = {},
  ) => `${NEWS_API}/auth/microsoft/login${qs({ next, ...extra })}`,
};

/** ¿Tiene `code` en algún alcance? (para mostrar u ocultar; el backend vuelve a verificar). */
export const can = (p: NewsPermissions | undefined, code: string) => !!p?.permissions.includes(code);

/** Permisos del módulo de noticias que habilitan el panel. */
export const hasNewsAccess = (p: NewsPermissions | undefined) =>
  !!p?.permissions.some((code) => code.startsWith('news.'));
