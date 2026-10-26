// Datos que el portal guarda por id en un solo JSON (Metri-K aún no los tiene):
// - Página oficial de cada centro (vista oculta /admin/centros).
// - Ranking de productividad USB de cada investigador y quiénes se ocultan (vista oculta /admin/ranking).
// - Ranking de publicaciones Scopus, por puesto (vista oculta /admin/produccion).
// Dos almacenamientos con la misma interfaz (ver stores.ts): un JSON en disco en local / servidor
// propio y Vercel Blob en Vercel. Migrar a Metri-K cuando el backend los soporte.
import fs from 'node:fs';
import path from 'node:path';
import type { AuthorRanking } from '../src/domain/authors/author.ts';
import { QUARTILES, type Quartile, type StoredPublication } from '../src/domain/publications/publication.ts';

/** Limpia un valor; null = sin valor (se quita la entrada). */
export type Normalize<T> = (v: unknown) => T | null;

export interface MapStore<T> {
  all(): Promise<Record<string, T>>;
  /** Devuelve lo guardado (normalizado); null = la entrada quedó vacía. */
  set(id: number, value: unknown): Promise<T | null>;
  /** Reemplaza el mapa completo (lo inválido se descarta); devuelve lo guardado. */
  replace(all: Record<string, unknown>): Promise<Record<string, T>>;
}

/** URL http(s) absoluta; acepta "www.ejemplo.co" (se asume https). */
export const normalizeWebsite: Normalize<string> = (v) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 300) return null;
  const s = v.trim();
  try {
    const u = new URL(/^[a-z][\w+.-]*:/i.test(s) ? s : `https://${s}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : null;
  } catch {
    return null;
  }
};

/** Marca sí/no (p. ej. investigador oculto); false o vacío quitan la entrada. */
export const normalizeFlag: Normalize<true> = (v) => (v === true ? true : null);

const rank = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);

/** Ranking USB: índice 0–100 (un decimal) y puestos enteros positivos. */
export const normalizeRanking: Normalize<AuthorRanking> = (v) => {
  const r = v as Partial<Record<keyof AuthorRanking, unknown>> | null;
  if (!r || typeof r !== 'object') return null;
  const index =
    typeof r.index === 'number' && r.index >= 0 && r.index <= 100 ? Math.round(r.index * 10) / 10 : null;
  const position = rank(r.rank);
  if (index === null || position === null) return null;
  const center = typeof r.center === 'string' && r.center.trim() ? r.center.trim().slice(0, 40) : null;
  return { index, rank: position, centerRank: center ? rank(r.centerRank) : null, center };
};

const text = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null;
const texts = (v: unknown, max: number) =>
  Array.isArray(v) ? [...new Set(v.flatMap((x) => text(x, 80) ?? []))].slice(0, max) : [];
const count = (v: unknown) => (typeof v === 'number' && v >= 0 ? Math.floor(v) : 0);

/** Publicación del ranking: EID de Scopus, título y puesto obligatorios; lo demás, si es válido. */
export const normalizePublication: Normalize<StoredPublication> = (v) => {
  const r = v as Partial<Record<keyof StoredPublication, unknown>> | null;
  if (!r || typeof r !== 'object') return null;
  const eid = typeof r.eid === 'string' ? /^2-s2\.0-\d{6,15}$/.exec(r.eid.trim())?.[0] : undefined;
  const title = text(r.title, 600);
  const position = rank(r.rank);
  if (!eid || !title || position === null) return null;
  const year = Number.isInteger(r.year) && (r.year as number) > 1900 ? (r.year as number) : null;
  const score =
    typeof r.score === 'number' && r.score >= 0 && r.score <= 100 ? Math.round(r.score * 100) / 100 : 0;
  return {
    rank: position,
    score,
    eid,
    doi: (typeof r.doi === 'string' && /^10\.\d{4,9}\/\S+$/.exec(r.doi.trim())?.[0]) || null,
    title,
    abstract: text(r.abstract, 6000),
    year,
    type: text(r.type, 40),
    journal: text(r.journal, 300),
    issn: texts(r.issn, 4).flatMap((x) => {
      const m = /^(\d{4})-?(\d{3}[\dX])$/i.exec(x);
      return m ? [`${m[1]}-${m[2]!.toUpperCase()}`] : [];
    }),
    language:
      (typeof r.language === 'string' && /^[a-z]{2,3}$/.exec(r.language.trim().toLowerCase())?.[0]) || null,
    quartile: QUARTILES.includes(r.quartile as Quartile) ? (r.quartile as Quartile) : null,
    areas: texts(r.areas, 5),
    citations: count(r.citations),
    openAccess: r.openAccess === true,
    international: r.international === true,
    countries: texts(r.countries, 60),
    correspondence: r.correspondence === true,
    authorsCount: count(r.authorsCount) || null,
  };
};

/** Limpia lo leído (archivo editado a mano, versión vieja…): solo entradas válidas. */
export function parseMap<T>(raw: unknown, normalize: Normalize<T>): Record<string, T> {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => [k, normalize(v)] as const)
      .filter(([k, v]) => /^\d{1,12}$/.test(k) && v !== null),
  ) as Record<string, T>;
}

/** Aplica un cambio sobre el mapa completo; devuelve el mapa nuevo y lo guardado para el id. */
export function withEntry<T>(
  all: Record<string, T>,
  id: number,
  value: unknown,
  normalize: Normalize<T>,
): [Record<string, T>, T | null] {
  const clean = normalize(value);
  const next = { ...all };
  if (clean !== null) next[id] = clean;
  else delete next[id];
  return [next, clean];
}

/** Disco: sin estado en memoria, cada consulta lee el archivo (así ven lo mismo todos los procesos). */
export function createDiskMapStore<T>(file: string, normalize: Normalize<T>): MapStore<T> {
  // El directorio se crea al guardar, no al arrancar (ver createDiskPhotoStore).
  const readAll = () => {
    try {
      return parseMap(JSON.parse(fs.readFileSync(file, 'utf8')), normalize);
    } catch {
      return {};
    }
  };
  const write = (next: Record<string, T>) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, file); // reemplazo atómico
  };
  return {
    all: async () => readAll(),
    async set(id, value) {
      const [next, clean] = withEntry(readAll(), id, value, normalize);
      write(next);
      return clean;
    },
    async replace(all) {
      const next = parseMap(all, normalize);
      write(next);
      return next;
    },
  };
}
