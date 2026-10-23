// Producción científica destacada (/productos): publicaciones Scopus de los investigadores
// seleccionados, rankeadas por el modelo de puntaje del Excel que se carga en /admin/produccion.
// Solo tipos (`import type`) además de funciones puras: lo importan el BFF y el prerender en Node.

export const QUARTILES = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type Quartile = (typeof QUARTILES)[number];

export const PUBLICATION_SORTS = ['rank', 'recent', 'cited'] as const;
export type PublicationSort = (typeof PUBLICATION_SORTS)[number];

/** Investigador de Metri-K que firma la publicación (cruce por EID con su producción Scopus). */
export interface PublicationAuthor {
  id: number;
  name: string;
  /** Tiene perfil público en el portal (si no, se muestra el nombre sin enlace). */
  published: boolean;
}

/** Fila del ranking tal como se guarda (lo que el portal usa del Excel). */
export interface StoredPublication {
  /** Puesto en el ranking del Excel (1 = mayor puntaje). */
  rank: number;
  /** Puntaje del modelo, 0–100. */
  score: number;
  /** Identificador de Scopus, p. ej. "2-s2.0-85132899267". */
  eid: string;
  doi: string | null;
  title: string;
  abstract: string | null;
  year: number | null;
  /** Tipo documental de Scopus (Article, Review, Conference Paper…). */
  type: string | null;
  journal: string | null;
  /** ISSN de la revista, "1999-4923" (impreso y electrónico, si tiene ambos). */
  issn: string[];
  /** Código ISO 639 del idioma, p. ej. "eng", "spa". */
  language: string | null;
  quartile: Quartile | null;
  /** Grandes áreas QS de la revista. */
  areas: string[];
  citations: number;
  openAccess: boolean;
  international: boolean;
  /** Países de afiliación de los autores. */
  countries: string[];
  /** Un autor institucional firma como autor de correspondencia. */
  correspondence: boolean;
  authorsCount: number | null;
}

export interface RankedPublication extends StoredPublication {
  authors: PublicationAuthor[];
}

/** Publicación en un resultado: `position` es su puesto por puntaje entre las que cumplen el filtro. */
export interface ListedPublication extends RankedPublication {
  position: number;
}

export interface PublicationQuery {
  search?: string;
  /** Rango de años, ambos inclusive. */
  yearFrom?: number;
  yearTo?: number;
  quartile?: Quartile;
  type?: string;
  area?: string;
  openAccess?: boolean;
  sort?: PublicationSort;
  page: number;
  pageSize: number;
}

export interface PublicationPage {
  items: ListedPublication[];
  total: number;
  page: number;
  pages: number;
}

/** Totales y opciones de filtro sobre todo el ranking publicado. */
export interface PublicationStats {
  total: number;
  byQuartile: Record<Quartile, number>;
  openAccess: number;
  international: number;
  citations: number;
  /** De más reciente a más antiguo. */
  years: number[];
  types: string[];
  areas: string[];
}

export interface PublicationRepository {
  list(q: PublicationQuery, signal?: AbortSignal): Promise<PublicationPage>;
  stats(signal?: AbortSignal): Promise<PublicationStats>;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const SORTS: Record<PublicationSort, (a: RankedPublication, b: RankedPublication) => number> = {
  rank: (a, b) => a.rank - b.rank,
  recent: (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.rank - b.rank,
  cited: (a, b) => b.citations - a.citations || a.rank - b.rank,
};

/**
 * Búsqueda (título, revista, DOI, autores), filtros, orden y página; la usa el BFF.
 * El puesto se recalcula entre las que cumplen el filtro (1, 2, 3… por puntaje), sea cual sea el
 * orden elegido; `rank` conserva el puesto general del Excel.
 */
export function queryPublications(all: RankedPublication[], q: PublicationQuery): PublicationPage {
  const term = fold(q.search?.trim() ?? '');
  // Un rango invertido (desde 2024 hasta 2020) se toma al derecho.
  const [from, to] =
    q.yearFrom && q.yearTo && q.yearFrom > q.yearTo ? [q.yearTo, q.yearFrom] : [q.yearFrom, q.yearTo];
  const items = all
    .filter(
      (p) =>
        (!from || (p.year !== null && p.year >= from)) &&
        (!to || (p.year !== null && p.year <= to)) &&
        (!q.quartile || p.quartile === q.quartile) &&
        (!q.type || p.type === q.type) &&
        (!q.area || p.areas.includes(q.area)) &&
        (!q.openAccess || p.openAccess) &&
        (!term ||
          fold(
            `${p.title} ${p.journal ?? ''} ${p.issn.join(' ')} ${p.doi ?? ''} ${p.authors.map((a) => a.name).join(' ')}`,
          ).includes(term)),
    )
    .sort(SORTS.rank)
    .map((p, i) => ({ ...p, position: i + 1 }))
    .sort(SORTS[q.sort ?? 'rank']);
  const pages = Math.ceil(items.length / q.pageSize);
  const start = (q.page - 1) * q.pageSize;
  return { items: items.slice(start, start + q.pageSize), total: items.length, page: q.page, pages };
}

const byCount = (values: string[]) => {
  const n = new Map<string, number>();
  for (const v of values) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v);
};

export function publicationStats(all: StoredPublication[]): PublicationStats {
  const byQuartile = Object.fromEntries(QUARTILES.map((x) => [x, 0])) as Record<Quartile, number>;
  for (const p of all) if (p.quartile) byQuartile[p.quartile]++;
  return {
    total: all.length,
    byQuartile,
    openAccess: all.filter((p) => p.openAccess).length,
    international: all.filter((p) => p.international).length,
    citations: all.reduce((n, p) => n + p.citations, 0),
    years: [...new Set(all.flatMap((p) => (p.year ? [p.year] : [])))].sort((a, b) => b - a),
    types: byCount(all.flatMap((p) => (p.type ? [p.type] : []))),
    areas: byCount(all.flatMap((p) => p.areas)),
  };
}

/**
 * Autores de cada publicación: los investigadores de Metri-K cuya producción Scopus incluye el EID.
 * `names` son los activos en GrupLAC; `published`, los que tienen perfil en el portal.
 */
export function withAuthors(
  all: StoredPublication[],
  byEid: Map<string, number[]>,
  names: Map<number, string>,
  published: Set<number>,
): RankedPublication[] {
  return all.map((p) => ({
    ...p,
    authors: (byEid.get(p.eid) ?? []).flatMap((id) => {
      const name = names.get(id);
      return name ? [{ id, name, published: published.has(id) }] : [];
    }),
  }));
}

/** Enlace a la publicación: el DOI si lo hay; si no, el registro en Scopus. */
export const publicationUrl = (p: Pick<StoredPublication, 'doi' | 'eid'>) =>
  p.doi
    ? `https://doi.org/${p.doi}`
    : `https://www.scopus.com/inward/record.uri?eid=${encodeURIComponent(p.eid)}`;
