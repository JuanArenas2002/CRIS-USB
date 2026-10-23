import { withBase } from '@/shared/base';
// Ranking de publicaciones Scopus (vista oculta /admin/produccion). El navegador lee el Excel y envía
// solo lo que /productos muestra; los aportes del modelo, categorías SCImago y demás columnas no
// salen del equipo. El BFF valida cada fila y guarda el ranking por puesto.
import { ApiError } from '@/infrastructure/http/api-client';
import type { StoredPublication } from '@/domain/publications/publication';

export const PUBLICATIONS_SHEET = 'Ranking';

export interface PublicationsResult {
  published: number;
  /** Filas sin EID, título o puesto válidos ("#puesto EID"). */
  invalid: string[];
  /** Publicaciones sin ningún investigador seleccionado de Metri-K como autor. */
  unlinked: number;
}

const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Columnas del Excel (cabecera sin tildes, espacios ni signos) → campo. */
const REQUIRED = { eid: 'eid', title: 'titulo', score: 'puntaje' } as const;
const OPTIONAL = {
  doi: 'doi',
  abstract: 'abstract',
  year: 'ano',
  type: 'tipodocumental',
  journal: 'revista',
  issn: 'issn',
  language: 'idioma',
  quartile: 'cuartil',
  citations: 'citas',
  openAccess: 'openaccess',
  international: 'coautoriainternacional',
  countries: 'paisesdeafiliacion',
  correspondence: 'correspondenciainstitucional',
  authorsCount: 'autores', // «# Autores»
} as const;
const AREAS = ['granarea1', 'granarea2', 'granarea3', 'granarea4', 'granarea5'];

const num = (v: string | undefined) => {
  const n = Number((v ?? '').replace(',', '.'));
  return v && Number.isFinite(n) ? n : null;
};
const yes = (v: string | undefined) => key(v ?? '') === 'si';
const list = (v: string | undefined) => (v ?? '').split('|').flatMap((x) => (x.trim() ? [x.trim()] : []));

/** Filas de la hoja → publicaciones. Falla con un mensaje claro si falta una columna obligatoria. */
export function publicationRows(table: string[][]): StoredPublication[] {
  const headerAt = table.findIndex((r) => r.some((c) => key(c) === REQUIRED.eid));
  if (headerAt < 0) throw new Error('No se encontró la columna «EID» en la hoja');
  const raw = table[headerAt]!;
  const header = raw.map(key);
  const missing = Object.values(REQUIRED).filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Faltan columnas en la hoja: ${missing.join(', ')}`);
  const at = (col: string) => header.indexOf(col);
  const rankAt = raw.findIndex((c) => c.trim() === '#');
  const areasAt = AREAS.map(at).filter((i) => i >= 0);

  return table.slice(headerAt + 1).flatMap((r, i) => {
    const cell = (col: string) => {
      const j = at(col);
      return j < 0 ? undefined : r[j] || undefined;
    };
    const eid = cell(REQUIRED.eid)?.trim();
    if (!eid) return [];
    const quartile = cell(OPTIONAL.quartile)?.toUpperCase();
    return [
      {
        // Sin columna «#», el orden de las filas es el puesto.
        rank: (rankAt >= 0 ? num(r[rankAt]) : null) ?? i + 1,
        score: num(cell(REQUIRED.score)) ?? 0,
        eid,
        doi: cell(OPTIONAL.doi) ?? null,
        title: cell(REQUIRED.title) ?? '',
        abstract: cell(OPTIONAL.abstract) ?? null,
        year: num(cell(OPTIONAL.year)),
        type: cell(OPTIONAL.type) ?? null,
        journal: cell(OPTIONAL.journal) ?? null,
        // «19994923» o «14220067 16616596» (impreso y electrónico).
        issn: (cell(OPTIONAL.issn) ?? '').split(/[\s,;|]+/).flatMap((x) => {
          const m = /^(\d{4})-?(\d{3}[\dX])$/i.exec(x);
          return m ? [`${m[1]}-${m[2]!.toUpperCase()}`] : [];
        }),
        language: cell(OPTIONAL.language)?.toLowerCase() ?? null,
        quartile: /^Q[1-4]$/.test(quartile ?? '') ? (quartile as StoredPublication['quartile']) : null,
        areas: areasAt.flatMap((j) => (r[j] ? [r[j]] : [])),
        citations: num(cell(OPTIONAL.citations)) ?? 0,
        openAccess: yes(cell(OPTIONAL.openAccess)),
        international: yes(cell(OPTIONAL.international)),
        countries: list(cell(OPTIONAL.countries)),
        correspondence: yes(cell(OPTIONAL.correspondence)),
        authorsCount: num(cell(OPTIONAL.authorsCount)),
      },
    ];
  });
}

async function call(
  method: 'PUT' | 'DELETE',
  token: string,
  rows?: StoredPublication[],
): Promise<PublicationsResult> {
  const res = await fetch(withBase('/api/publications'), {
    method,
    headers: { 'X-Admin-Token': token, ...(rows ? { 'Content-Type': 'application/json' } : {}) },
    body: rows ? JSON.stringify({ rows }) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Partial<PublicationsResult> & { detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return { published: data.published ?? 0, invalid: data.invalid ?? [], unlinked: data.unlinked ?? 0 };
}

export const uploadPublications = (rows: StoredPublication[], token: string) => call('PUT', token, rows);
export const clearPublications = (token: string) => call('DELETE', token);
