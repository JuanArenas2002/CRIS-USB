// Datos que el portal guarda por id en un solo JSON (Metri-K aún no los tiene):
// - ODS de cada grupo (vista oculta /admin/ods).
// - Página oficial de cada centro (vista oculta /admin/centros).
// - Ranking de productividad USB de cada investigador y quiénes se ocultan (vista oculta /admin/ranking).
// Dos almacenamientos con la misma interfaz (ver stores.ts): un JSON en disco en local / servidor
// propio y Vercel Blob en Vercel. Migrar a Metri-K cuando el backend los soporte.
import fs from 'node:fs';
import path from 'node:path';
import type { AuthorRanking } from '../src/domain/authors/author.ts';
import { normalizeOds, type OdsId } from '../src/domain/ods/ods.ts';

/** Limpia un valor; null = sin valor (se quita la entrada). */
export type Normalize<T> = (v: unknown) => T | null;

export interface MapStore<T> {
  all(): Promise<Record<string, T>>;
  /** Devuelve lo guardado (normalizado); null = la entrada quedó vacía. */
  set(id: number, value: unknown): Promise<T | null>;
  /** Reemplaza el mapa completo (lo inválido se descarta); devuelve lo guardado. */
  replace(all: Record<string, unknown>): Promise<Record<string, T>>;
}

export type OdsMap = Record<string, OdsId[]>;
export type OdsStore = MapStore<OdsId[]>;

/** ODS válidos; lista vacía = el grupo queda sin ODS. */
export const normalizeOdsEntry: Normalize<OdsId[]> = (v) => {
  const ods = normalizeOds(v);
  return ods.length ? ods : null;
};

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
