// Datos que el portal guarda por id en un solo JSON (Metri-K aún no los tiene):
// - ODS de cada grupo (vista oculta /admin/ods).
// - Página oficial de cada centro (vista oculta /admin/centros).
// Dos almacenamientos con la misma interfaz (ver stores.ts): un JSON en disco en local / servidor
// propio y Vercel Blob en Vercel. Migrar a Metri-K cuando el backend los soporte.
import fs from 'node:fs';
import path from 'node:path';
import { normalizeOds, type OdsId } from '../src/domain/ods/ods.ts';

/** Limpia un valor; null = sin valor (se quita la entrada). */
export type Normalize<T> = (v: unknown) => T | null;

export interface MapStore<T> {
  all(): Promise<Record<string, T>>;
  /** Devuelve lo guardado (normalizado); null = la entrada quedó vacía. */
  set(id: number, value: unknown): Promise<T | null>;
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
  return {
    all: async () => readAll(),
    async set(id, value) {
      const [next, clean] = withEntry(readAll(), id, value, normalize);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
      fs.renameSync(tmp, file); // reemplazo atómico
      return clean;
    },
  };
}
