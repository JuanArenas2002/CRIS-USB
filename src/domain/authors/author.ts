import type { OdsId } from '../ods/ods';

/** Categorías Minciencias de investigador, de mayor a menor. */
export const AUTHOR_CATEGORIES = [
  { id: 'emerito', label: 'Emérito', code: 'IE' },
  { id: 'senior', label: 'Sénior', code: 'IS' },
  { id: 'asociado', label: 'Asociado', code: 'IA' },
  { id: 'junior', label: 'Junior', code: 'IJ' },
] as const;
export type AuthorCategoryId = (typeof AUTHOR_CATEGORIES)[number]['id'];

export interface GroupRef {
  id: number;
  code: string;
  name: string;
  /** Categoría del grupo (A1, A, B, C) cuando se conoce. */
  category?: string | null;
  /** ODS asignados al grupo en el portal (solo en el perfil del investigador). */
  ods?: OdsId[];
}

/** Investigador tal como lo publica el portal (fuente: Metri-K). Sin datos personales. */
export interface Author {
  id: number;
  name: string;
  category: AuthorCategoryId | null;
  /** Máximo nivel de formación (p. ej. "Doctorado"). */
  degree: string | null;
  orcid: string | null;
  scopusId: string | null;
  cvlacUrl: string | null;
  scholarUrl: string | null;
  mainGroup: GroupRef | null;
  /** Solo para investigadores seleccionados (destacados) en Metri-K; null para el resto. */
  metrics: AuthorMetrics | null;
  /** Foto alojada por el propio portal (Metri-K no tiene fotos); null si no se ha asignado. */
  photoUrl: string | null;
}

export interface AuthorMetrics {
  /** Mayor índice H entre sus perfiles de Scopus. */
  hIndex: number | null;
  scopusPublications: number;
  /** Publicaciones + desarrollos + trabajos de formación + libros. */
  products: number;
}

export interface ScopusPublication {
  id: number;
  title: string;
  year: number | null;
  journal: string | null;
  type: string | null;
  citedBy: number;
  doi: string | null;
  url: string | null;
  authors: string | null;
}

export interface Thesis {
  id: number;
  title: string;
  year: number | null;
  /** Pregrado, Especialización, Maestría, Doctorado. */
  level: string | null;
  program: string | null;
  url: string | null;
  authors: string | null;
}

export interface TechDevelopment {
  id: number;
  title: string;
  year: number | null;
  kind: string | null;
  company: string | null;
}

export interface AuthorProduction {
  publications: ScopusPublication[];
  theses: Thesis[];
  developments: TechDevelopment[];
}

/** Perfil completo: además, todos los grupos activos y, si es destacado, su producción. */
export interface AuthorProfile extends Author {
  groups: GroupRef[];
  production: AuthorProduction | null;
}

export interface AuthorStats {
  total: number;
  byCategory: Record<AuthorCategoryId, number>;
}

export interface ExternalProfile {
  label: string;
  value: string;
  url: string;
}

export const categoryOf = (id: AuthorCategoryId | null) =>
  id ? (AUTHOR_CATEGORIES.find((c) => c.id === id) ?? null) : null;

/** "Sénior (IS)" → "senior"; "Sin Categoría" → null. */
export function parseCategory(raw: string | null | undefined): AuthorCategoryId | null {
  const s = (raw ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return AUTHOR_CATEGORIES.find((c) => s.startsWith(c.id))?.id ?? null;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // quita tildes tras NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `123-gustavo-aroca` — el id resuelve el recurso, el nombre hace la URL legible. */
export function authorSlug(a: { id: number; name: string }): string {
  const name = slugify(a.name);
  return name ? `${a.id}-${name}` : String(a.id);
}

export function parseAuthorId(slug: string | undefined): number | null {
  const id = Number(/^(\d+)(?:-|$)/.exec(slug ?? '')?.[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const LOWER_WORDS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von']);

/** "AROCA MARTÍNEZ G." → "Aroca Martínez G.". Solo presentación: las fuentes guardan muchos nombres en mayúsculas. */
export function displayName(name: string): string {
  if (name !== name.toUpperCase()) return name.trim();
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (/^(\p{L}\.)+$/u.test(w)) return w.toUpperCase(); // iniciales: G. / M.E.
      if (i > 0 && LOWER_WORDS.has(w)) return w;
      return w.replace(/(^|[-'])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
    })
    .join(' ');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Perfiles externos construidos solo con los identificadores que trae la fuente. */
export function externalProfiles(
  a: Pick<Author, 'orcid' | 'scopusId' | 'cvlacUrl' | 'scholarUrl'>,
): ExternalProfile[] {
  const out: ExternalProfile[] = [];
  if (a.orcid) out.push({ label: 'ORCID', value: a.orcid, url: `https://orcid.org/${a.orcid}` });
  if (a.scopusId)
    out.push({
      label: 'Scopus',
      value: a.scopusId,
      url: `https://www.scopus.com/authid/detail.uri?authorId=${encodeURIComponent(a.scopusId)}`,
    });
  if (a.cvlacUrl) out.push({ label: 'CvLAC', value: 'Hoja de vida Minciencias', url: a.cvlacUrl });
  if (a.scholarUrl) out.push({ label: 'Google Scholar', value: 'Perfil de citas', url: a.scholarUrl });
  return out;
}

// ── Consulta del directorio (la usa el BFF sobre la lista completa en memoria) ──────────────

export interface AuthorListQuery {
  search?: string;
  category?: AuthorCategoryId;
  groupId?: number;
  page: number;
  pageSize: number;
}

export interface AuthorListPage {
  items: Author[];
  total: number;
  page: number;
  pages: number;
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const rank = (c: AuthorCategoryId | null) => {
  const i = AUTHOR_CATEGORIES.findIndex((x) => x.id === c);
  return i === -1 ? AUTHOR_CATEGORIES.length : i;
};

/** Filtra, ordena (mayor categoría primero, luego alfabético) y pagina. */
export function queryAuthors(all: Author[], q: AuthorListQuery): AuthorListPage {
  const term = norm(q.search?.trim() ?? '');
  const items = all
    .filter(
      (a) =>
        (!q.category || a.category === q.category) &&
        (!q.groupId || a.mainGroup?.id === q.groupId) &&
        (!term || norm(a.name).includes(term) || (a.orcid ?? '').includes(term)),
    )
    .sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name, 'es'));
  const pages = Math.ceil(items.length / q.pageSize);
  const start = (q.page - 1) * q.pageSize;
  return { items: items.slice(start, start + q.pageSize), total: items.length, page: q.page, pages };
}

/** Destacados: mayor índice H primero, luego más publicaciones. */
export function featuredAuthors(all: Author[]): Author[] {
  return all
    .filter((a) => a.metrics)
    .sort(
      (a, b) =>
        (b.metrics!.hIndex ?? -1) - (a.metrics!.hIndex ?? -1) ||
        b.metrics!.scopusPublications - a.metrics!.scopusPublications,
    );
}

export function authorStats(all: Author[]): AuthorStats {
  const byCategory = Object.fromEntries(AUTHOR_CATEGORIES.map((c) => [c.id, 0])) as Record<
    AuthorCategoryId,
    number
  >;
  for (const a of all) if (a.category) byCategory[a.category]++;
  return { total: all.length, byCategory };
}

// ── Producción unificada por tipología Minciencias (perfil del investigador) ─────────────────

export const TYPOLOGIES = [
  { id: 'GNC', label: 'Generación de nuevo conocimiento', short: 'Nuevo Conocimiento', icon: 'menu_book' },
  {
    id: 'DTI',
    label: 'Desarrollo tecnológico e innovación',
    short: 'Desarrollo Tecnológico',
    icon: 'precision_manufacturing',
  },
  { id: 'ASC', label: 'Apropiación social del conocimiento', short: 'Apropiación Social', icon: 'campaign' },
  { id: 'FRH', label: 'Formación de recurso humano', short: 'Formación', icon: 'school' },
] as const;
export type TypologyId = (typeof TYPOLOGIES)[number]['id'];

export interface Product {
  key: string;
  typology: TypologyId;
  /** Tipo de producto Minciencias (p. ej. "Artículo científico", "Tesis de maestría"). */
  type: string;
  title: string;
  authors: string | null;
  year: number | null;
  /** Revista, programa o entidad. */
  venue: string | null;
  /** Indexación o detalle (p. ej. "Scopus · Review"). */
  index: string | null;
  doi: string | null;
  url: string | null;
}

const SCOPUS_TYPE: Record<string, string> = {
  'Book chapter': 'Capítulo de libro resultado de investigación',
  'Conference paper': 'Ponencia',
};
const THESIS_TYPE: Record<string, string> = {
  pregrado: 'Trabajo de grado pregrado',
  especializacion: 'Trabajo de grado especialización',
  maestria: 'Tesis de maestría',
  doctorado: 'Tesis doctoral',
};
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Aplana la producción en productos con su tipología Minciencias; más recientes primero. */
export function toProducts(p: AuthorProduction): Product[] {
  return [
    ...p.publications.map((x): Product => ({
      key: `p${x.id}`,
      typology: 'GNC',
      type: SCOPUS_TYPE[x.type ?? ''] ?? 'Artículo científico',
      title: x.title,
      authors: x.authors,
      year: x.year,
      venue: x.journal,
      index: ['Scopus', x.type].filter(Boolean).join(' · '),
      doi: x.doi,
      url: x.doi ? `https://doi.org/${x.doi}` : x.url,
    })),
    ...p.developments.map((x): Product => ({
      key: `d${x.id}`,
      typology: 'DTI',
      type: 'Producto tecnológico',
      title: x.title,
      authors: null,
      year: x.year,
      venue: x.company,
      index: x.kind,
      doi: null,
      url: null,
    })),
    ...p.theses.map((x): Product => ({
      key: `t${x.id}`,
      typology: 'FRH',
      type: THESIS_TYPE[fold(x.level ?? '')] ?? 'Trabajo de grado',
      title: x.title,
      authors: x.authors,
      year: x.year,
      venue: x.program,
      index: 'Repositorio institucional',
      doi: null,
      url: x.url,
    })),
  ].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

/**
 * Une la producción de varios investigadores (p. ej. los integrantes de un grupo) sin contar dos
 * veces un producto en coautoría: mismo título normalizado y mismo año. Más recientes primero.
 */
export function mergeProducts(lists: Product[][]): Product[] {
  const seen = new Map<string, Product>();
  for (const p of lists.flat()) {
    const k = `${fold(p.title)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()}|${p.year ?? ''}`;
    if (!seen.has(k)) seen.set(k, p);
  }
  return [...seen.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}
