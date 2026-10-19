// ODS asignados a cada grupo desde la vista oculta /admin/ods (Metri-K aún no los tiene).
// Dos almacenamientos con la misma interfaz (ver stores.ts): un JSON en disco en local / servidor
// propio y Vercel Blob en Vercel. Migrar a Metri-K cuando el backend los soporte.
import fs from 'node:fs';
import path from 'node:path';
import { normalizeOds, type OdsId } from '../src/domain/ods/ods.ts';

export type OdsMap = Record<string, OdsId[]>;

export interface OdsStore {
  all(): Promise<OdsMap>;
  /** Devuelve lo guardado (normalizado). Lista vacía = el grupo queda sin ODS. */
  set(groupId: number, ods: unknown): Promise<OdsId[]>;
}

/** Limpia lo leído (archivo editado a mano, versión vieja…): solo ODS válidos por grupo. */
export function parseOdsMap(raw: unknown): OdsMap {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => [k, normalizeOds(v)] as const)
      .filter(([k, v]) => /^\d{1,12}$/.test(k) && v.length),
  );
}

/** Aplica un cambio sobre el mapa completo; devuelve el mapa nuevo y lo guardado para el grupo. */
export function withOds(all: OdsMap, groupId: number, ods: unknown): [OdsMap, OdsId[]] {
  const clean = normalizeOds(ods);
  const next = { ...all };
  if (clean.length) next[groupId] = clean;
  else delete next[groupId];
  return [next, clean];
}

/** Disco: sin estado en memoria, cada consulta lee el archivo (así ven lo mismo todos los procesos). */
export function createDiskOdsStore(file: string): OdsStore {
  // El directorio se crea al guardar, no al arrancar (ver createDiskPhotoStore).
  const readAll = (): OdsMap => {
    try {
      return parseOdsMap(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      return {};
    }
  };
  return {
    all: async () => readAll(),
    async set(groupId, ods) {
      const [next, clean] = withOds(readAll(), groupId, ods);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
      fs.renameSync(tmp, file); // reemplazo atómico
      return clean;
    },
  };
}
