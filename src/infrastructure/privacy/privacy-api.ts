import { z } from 'zod';
import { call } from '@/infrastructure/news/news-http';

/** Políticas versionadas y categorías de cookies (públicas; las administra el backend con privacy.manage). */
export const POLICY_KINDS = ['privacy_policy', 'cookie_policy', 'privacy_notice'] as const;
export type PolicyKind = (typeof POLICY_KINDS)[number];

const policySchema = z.object({
  kind: z.enum(POLICY_KINDS),
  version: z.number(),
  title: z.string(),
  summary: z.string(),
  content: z.string(), // HTML saneado por el backend (nh3)
  effective_at: z.string(),
});
const currentSchema = policySchema.extend({
  versions: z.array(z.object({ version: z.number(), effective_at: z.string(), title: z.string() })),
});
const technologySchema = z.object({
  name: z.string(),
  type: z.string(),
  duration: z.string(),
  provider: z.string(),
  purpose: z.string(),
});
const categorySchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  purpose: z.string(),
  technologies: z.array(technologySchema),
  retention: z.string(),
  is_required: z.boolean(),
  is_available: z.boolean(),
});

export type Policy = z.infer<typeof policySchema>;
export type CurrentPolicy = z.infer<typeof currentSchema>;
export type CookieCategory = z.infer<typeof categorySchema>;

export const privacyApi = {
  policies: () => call('/privacy/policies', z.array(currentSchema)),
  policy: (kind: PolicyKind, version: number) => call(`/privacy/policies/${kind}/${version}`, policySchema),
  categories: () => call('/privacy/cookie-categories', z.array(categorySchema)),
};
