import { withBase } from '@/shared/base';
// Ranking de productividad USB (vista oculta /admin/ranking). El navegador lee el Excel y envía solo
// lo que el portal usa (cédula, nombre, puestos, centro e índice); horas y demás columnas no salen
// del equipo. El BFF cruza la cédula con Metri-K y guarda el ranking por id de investigador.
import { ApiError } from '@/infrastructure/http/api-client';

export const RANKING_SHEET = 'Ranking_Completo';

export interface RankingRow {
  cc: string;
  name: string;
  rank: number;
  centerRank: number | null;
  center: string | null;
  index: number;
}

export interface RankingResult {
  published: number;
  /** Nombres de las filas cuya cédula no está en Metri-K. */
  notFound: string[];
  /** Están en Metri-K pero no activos en GrupLAC (no se publican). */
  inactive: string[];
  /** Sin puesto general o con índice fuera de 0–100. */
  invalid: string[];
}

const key = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Columnas del Excel (cabecera sin tildes, espacios ni signos) → campo. */
const COLUMNS = {
  cc: 'cc',
  name: 'nombrecompleto',
  rank: 'puestogeneral',
  centerRank: 'puestocentro',
  center: 'centrounificado',
  index: 'indiceproductividad',
} as const;

const num = (v: string | undefined) => {
  const n = Number((v ?? '').replace(',', '.'));
  return v && Number.isFinite(n) ? n : null;
};

/** Filas de la hoja → ranking. Falla con un mensaje claro si falta alguna columna. */
export function rankingRows(table: string[][]): RankingRow[] {
  const headerAt = table.findIndex((r) => r.some((c) => key(c) === COLUMNS.cc));
  if (headerAt < 0) throw new Error('No se encontró la columna «CC» en la hoja');
  const header = table[headerAt]!.map(key);
  const at = Object.fromEntries(
    Object.entries(COLUMNS).map(([field, col]) => [field, header.indexOf(col)]),
  ) as Record<keyof typeof COLUMNS, number>;
  const missing = Object.entries(at)
    .filter(([, i]) => i < 0)
    .map(([field]) => field);
  if (missing.length) throw new Error(`Faltan columnas en la hoja: ${missing.join(', ')}`);

  return table.slice(headerAt + 1).flatMap((r) => {
    const cc = (r[at.cc] ?? '').replace(/\D/g, '');
    if (!cc) return [];
    return [
      {
        cc,
        name: r[at.name] ?? '',
        rank: num(r[at.rank]) ?? 0,
        centerRank: num(r[at.centerRank]),
        center: r[at.center] || null,
        index: num(r[at.index]) ?? -1,
      },
    ];
  });
}

async function call(method: 'PUT' | 'DELETE', token: string, rows?: RankingRow[]): Promise<RankingResult> {
  const res = await fetch(withBase('/api/ranking'), {
    method,
    headers: { 'X-Admin-Token': token, ...(rows ? { 'Content-Type': 'application/json' } : {}) },
    body: rows ? JSON.stringify({ rows }) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Partial<RankingResult> & { detail?: string };
  if (!res.ok) throw new ApiError(res.status, data.detail ?? `Error ${res.status}`);
  return {
    published: data.published ?? 0,
    notFound: data.notFound ?? [],
    inactive: data.inactive ?? [],
    invalid: data.invalid ?? [],
  };
}

export const uploadRanking = (rows: RankingRow[], token: string) => call('PUT', token, rows);
export const clearRanking = (token: string) => call('DELETE', token);

/** Fila del ranking en el admin: puestos del Excel y los que se muestran (renumerados). */
export interface RankingAdminRow {
  id: number;
  name: string;
  index: number;
  rank: number;
  centerRank: number | null;
  center: string | null;
  hidden: boolean;
  /** Puestos visibles en el portal; null si está oculto. */
  shown: { rank: number; centerRank: number | null } | null;
}

async function admin<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withBase(path), {
    ...init,
    headers: { 'X-Admin-Token': token, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => null)) as (T & { detail?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? `Error ${res.status}`);
  // Un 200 que no es JSON (proxy, compresión mal aplicada…) es un error, no una lista vacía.
  if (!data) throw new ApiError(res.status, 'El servidor respondió con un formato inesperado.');
  return data;
}

export const listRanking = async (token: string) =>
  (await admin<{ rows: RankingAdminRow[] }>('/api/ranking', token)).rows;

/** Muestra u oculta a un investigador del ranking; se recuerda aunque se cargue otro Excel. */
export const setRankingVisible = (id: number, visible: boolean, token: string) =>
  admin<{ visible: boolean }>(`/api/ranking/${id}`, token, {
    method: 'PUT',
    body: JSON.stringify({ visible }),
  });

/** Muestra u oculta a varios a la vez (p. ej. todos los filtrados) en una sola escritura. */
export const setRankingVisibleMany = (ids: number[], visible: boolean, token: string) =>
  admin<{ visible: boolean; hidden: number }>('/api/ranking/visibility', token, {
    method: 'PUT',
    body: JSON.stringify({ ids, visible }),
  });
