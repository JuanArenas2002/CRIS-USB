// ODS asignados a cada grupo desde la vista oculta /admin/ods (Metri-K aún no los tiene).
// ponytail: almacenamiento temporal en un JSON en disco (`data/ods.json`); migrar a Metri-K cuando
// el backend los soporte.
// Sin estado en memoria: cada consulta lee el archivo, así ven lo mismo todos los procesos.
import fs from 'node:fs';
import path from 'node:path';
import { normalizeOds, type OdsId } from '../src/domain/ods/ods.ts';

export function createOdsStore(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const readAll = (): Record<string, OdsId[]> => {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, normalizeOds(v)]));
    } catch {
      return {};
    }
  };

  return {
    get: (groupId: number): OdsId[] => readAll()[groupId] ?? [],
    all: readAll,
    /** Devuelve lo guardado (normalizado). Lista vacía = el grupo queda sin ODS. */
    set(groupId: number, ods: unknown): OdsId[] {
      const all = readAll();
      const clean = normalizeOds(ods);
      if (clean.length) all[groupId] = clean;
      else delete all[groupId];
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
      fs.renameSync(tmp, file); // reemplazo atómico
      return clean;
    },
  };
}

export type OdsStore = ReturnType<typeof createOdsStore>;
