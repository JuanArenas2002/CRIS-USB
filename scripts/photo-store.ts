// Fotos de investigadores guardadas por el propio frontend (Metri-K no aloja fotos).
// ponytail: almacenamiento temporal en disco (`data/photos/{id}.webp`); migrar a un almacenamiento
// de objetos o a Metri-K cuando la fuente tenga fotos.
// Sin estado en memoria: cada consulta mira el disco, así ven lo mismo todos los procesos
// (y las instancias que Vite recrea al reiniciar en desarrollo).
import fs from 'node:fs';
import path from 'node:path';

export const MAX_PHOTO_BYTES = 1024 * 1024;

/** WebP real: "RIFF" + tamaño + "WEBP". El navegador ya recorta y convierte; aquí solo se valida. */
export const isWebp = (b: Buffer) =>
  b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';

export function createPhotoStore(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (id: number) => path.join(dir, `${id}.webp`);
  /** Versión = mtime en ms: cambia con cada foto nueva, así la URL se puede cachear como inmutable. */
  const version = (id: number): number | null => {
    try {
      return Math.floor(fs.statSync(file(id)).mtimeMs);
    } catch {
      return null;
    }
  };

  return {
    url(id: number): string | null {
      const v = version(id);
      return v === null ? null : `/api/investigators/${id}/photo?v=${v}`;
    },
    read(id: number): Buffer | null {
      try {
        return fs.readFileSync(file(id));
      } catch {
        return null;
      }
    },
    save(id: number, data: Buffer) {
      if (data.length > MAX_PHOTO_BYTES) throw new RangeError('La foto supera 1 MB');
      if (!isWebp(data)) throw new TypeError('La foto debe ser WebP');
      const tmp = `${file(id)}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, file(id)); // reemplazo atómico: nunca se sirve una foto a medio escribir
    },
    remove(id: number) {
      fs.rmSync(file(id), { force: true });
    },
  };
}

export type PhotoStore = ReturnType<typeof createPhotoStore>;
