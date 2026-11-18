import { z } from 'zod';
import { NEWS_API, call, qs, sendRaw } from '@/infrastructure/news/news-http';

/** URL usable por el navegador: las subidas viven en el backend (/media/...) y pasan por el proxy. */
export const mediaUrl = (url: string | null | undefined) =>
  !url
    ? null
    : url.startsWith('/media/')
      ? `${NEWS_API}${url}`
      : url.startsWith('https://') || url.startsWith('http://')
        ? url
        : null;

/**
 * Imagen responsive: el backend sirve versiones WebP de estos anchos (?w=). El navegador elige la menor que
 * cubra el tamaño en pantalla (`sizes`), en vez de descargar el original (hay fotos de 8000 px y varios MB).
 * URLs externas (http/https) se dejan tal cual.
 */
const WIDTHS = [320, 640, 960, 1280, 1920] as const;
export function responsiveImage(url: string | null | undefined, fallback: (typeof WIDTHS)[number] = 960) {
  const src = mediaUrl(url);
  if (!src || !src.startsWith(`${NEWS_API}/media/`)) return src ? { src } : null;
  return { src: `${src}?w=${fallback}`, srcSet: WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(', ') };
}

/**
 * HTML del cuerpo de la noticia para el portal: imágenes responsive y diferidas (debajo del primer pantallazo).
 * Solo para MOSTRAR: el editor usa htmlForBrowser/htmlForBackend, que no tocan los atributos.
 */
const CONTENT_IMG = new RegExp(
  `<img([^>]*?)\\ssrc="(${NEWS_API.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/media/news/[^"?]+)"`,
  'g',
);
export const articleHtml = (html: string) =>
  htmlForBrowser(html).replace(
    CONTENT_IMG,
    (_, attrs: string, src: string) =>
      `<img${attrs} loading="lazy" decoding="async" src="${src}?w=1280" srcset="${WIDTHS.map((w) => `${src}?w=${w} ${w}w`).join(', ')}" sizes="(min-width: 1024px) 780px, 100vw"`,
  );

/** HTML del backend (src="/media/...") <-> HTML para el navegador (src="/news-api/media/..."). */
export const htmlForBrowser = (html: string) => html.split('src="/media/').join(`src="${NEWS_API}/media/`);
export const htmlForBackend = (html: string) => html.split(`src="${NEWS_API}/media/`).join('src="/media/');

/** Noticias, catálogos y dependencias (Metri-K) del backend de noticias. */

const scopeSchema = z.object({ scope_type: z.string(), scope_id: z.number() });
const personSchema = z.object({
  person_type: z.string(),
  orcid: z.string(), // ORCID iD canónico: la persona se identifica por ORCID
  relationship_type: z.string(),
});

export const newsSchema = z.object({
  id: z.number(),
  title: z.string(),
  slug: z.string(),
  summary: z.string(),
  content: z.string(),
  image_url: z.string().nullable(),
  image_caption: z.string().nullable(),
  category_id: z.number(),
  author_id: z.number(),
  relevance_level: z.string(),
  priority: z.number(),
  is_featured: z.boolean(),
  is_pinned: z.boolean(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  status: z.string(),
  tags: z.array(z.string()),
  scopes: z.array(scopeSchema),
  people: z.array(personSchema),
});
export type News = z.infer<typeof newsSchema>;
export type NewsScope = z.infer<typeof scopeSchema>;
export type NewsPerson = z.infer<typeof personSchema>;

/** Lo que se envía al crear/editar (los catálogos van por código). */
export interface NewsInput {
  title: string;
  slug?: string | null;
  summary: string;
  content: string;
  image_url?: string | null;
  image_caption?: string | null;
  category_id: number;
  relevance_level: string;
  priority: number;
  is_featured: boolean;
  is_pinned: boolean;
  start_at: string | null;
  end_at: string | null;
  tags: string[];
  scopes: NewsScope[];
  people: NewsPerson[];
}

const item = z.object({ id: z.number(), code: z.string(), name: z.string() });
const catalogsSchema = z.object({
  statuses: z.array(item),
  relevance_levels: z.array(item),
  scope_types: z.array(item),
  person_types: z.array(item),
  relationship_types: z.array(item),
  categories: z.array(z.object({ id: z.number(), name: z.string() })),
});
export type Catalogs = z.infer<typeof catalogsSchema>;

const historySchema = z.object({
  actor_id: z.number(),
  actor_name: z.string().nullable().optional(),
  action: z.string(),
  from_status: z.string().nullable(),
  to_status: z.string(),
  reason: z.string().nullable(),
  at: z.string(),
});
export type NewsHistory = z.infer<typeof historySchema>;

export interface NewsFilter {
  public?: boolean; // vista pública aunque haya sesión (portada)
  status?: string;
  category_id?: number;
  scope_type?: string;
  scope_id?: number;
  orcid?: string;
  relevance_level?: string;
  tag?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
}

const unit = z.object({ id: z.number(), name: z.string(), is_active: z.boolean(), synced_at: z.string() });
const facultySchema = unit;
const centerSchema = unit.extend({
  code: z.string().nullable(),
  acronym: z.string().nullable(),
  date_created: z.string().nullable(),
  date_closed: z.string().nullable(),
});
const programSchema = unit.extend({
  faculty_id: z.number(),
  code_snies: z.string().nullable(),
  level_academic: z.string().nullable(),
  level_education: z.string().nullable(),
  modality: z.string().nullable(),
});
export type OrgUnit = z.infer<typeof unit>;
export type Program = z.infer<typeof programSchema>;
export type Center = z.infer<typeof centerSchema>;
const syncSchema = z.object({
  faculties: z.number(),
  centers: z.number(),
  programs: z.number(),
  faculties_deactivated: z.number(),
  centers_deactivated: z.number(),
  programs_deactivated: z.number(),
});

export const newsApi = {
  list: (f: NewsFilter = {}) => call(`/news${qs({ ...f })}`, z.array(newsSchema)),
  get: (id: number) => call(`/news/${id}`, newsSchema),
  /** Portal: solo publicadas y vigentes, sin importar la sesión. */
  publicList: (limit = 5) => call(`/news${qs({ public: true, limit })}`, z.array(newsSchema)),
  bySlug: (slug: string) => call(`/news/${encodeURIComponent(slug)}`, newsSchema),
  create: (body: NewsInput) => call('/news', newsSchema, { method: 'POST', body }),
  update: (id: number, body: Partial<NewsInput>) =>
    call(`/news/${id}`, newsSchema, { method: 'PATCH', body }),
  /** Imagen para insertar dentro del contenido; devuelve su ruta (/media/...). */
  uploadContentImage: (id: number, file: File) =>
    sendRaw(`/news/${id}/content-image`, z.object({ url: z.string() }), 'PUT', file),
  uploadImage: (id: number, file: File) => sendRaw(`/news/${id}/image`, newsSchema, 'PUT', file),
  history: (id: number) => call(`/news/${id}/history`, z.array(historySchema)),
  action: (id: number, action: 'submit' | 'approve' | 'publish') =>
    call(`/news/${id}/${action}`, newsSchema, { method: 'POST' }),
  reject: (id: number, reason: string) =>
    call(`/news/${id}/reject`, newsSchema, { method: 'POST', body: { reason } }),
  schedule: (id: number, start_at: string) =>
    call(`/news/${id}/schedule`, newsSchema, { method: 'POST', body: { start_at } }),
  archive: (id: number) => call(`/news/${id}`, newsSchema, { method: 'DELETE' }),

  catalogs: () => call('/news/catalogs', catalogsSchema),
  createCategory: (name: string) =>
    call('/news/categories', z.object({ id: z.number(), name: z.string() }), {
      method: 'POST',
      body: { name },
    }),

  faculties: (all = false) =>
    call(`/organization/faculties${qs({ include_inactive: all })}`, z.array(facultySchema)),
  centers: (all = false) =>
    call(`/organization/centers${qs({ include_inactive: all })}`, z.array(centerSchema)),
  programs: (facultyId?: number, all = false) =>
    call(
      facultyId
        ? `/organization/faculties/${facultyId}/programs${qs({ include_inactive: all })}`
        : `/organization/programs${qs({ include_inactive: all })}`,
      z.array(programSchema),
    ),
  sync: () => call('/organization/sync', syncSchema, { method: 'POST' }),
};
