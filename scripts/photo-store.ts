// Fotos de investigadores guardadas por el propio portal (Metri-K no aloja fotos).
// Dos almacenamientos con la misma interfaz (ver stores.ts): disco en local / servidor propio y
// Vercel Blob en Vercel (sin disco persistente). El navegador siempre las pide al BFF:
// `/api/investigators/{id}/photo?v={versión}`.
import fs from 'node:fs';
import path from 'node:path';

export const MAX_PHOTO_BYTES = 1024 * 1024;

/** WebP real: "RIFF" + tamaño + "WEBP". El navegador ya recorta y convierte; aquí solo se valida. */
export const isWebp = (b: Buffer) =>
  b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';

export function assertPhoto(data: Buffer) {
  if (data.length > MAX_PHOTO_BYTES) throw new RangeError('La foto supera 1 MB');
  if (!isWebp(data)) throw new TypeError('La foto debe ser WebP');
}

/** Versión = instante de la última subida (ms): cambia con cada foto, así la URL es inmutable. */
export const photoUrl = (id: number, version: number) => `/api/investigators/${id}/photo?v=${version}`;

export interface PhotoStore {
  /** id del investigador → versión de su foto. */
  versions(): Promise<Map<number, number>>;
  read(id: number): Promise<Buffer | null>;
  save(id: number, data: Buffer): Promise<void>;
  remove(id: number): Promise<void>;
}

/**
 * Disco: `{dir}/{id}.webp`. Sin estado en memoria: cada consulta mira el disco, así ven lo mismo
 * todos los procesos (y las instancias que Vite recrea al reiniciar en desarrollo).
 */
export function createDiskPhotoStore(dir: string): PhotoStore {
  // La carpeta se crea al guardar, no al arrancar: en un disco de solo lectura (Vercel sin Blob)
  // el BFF sigue sirviendo los datos y solo falla la escritura, con un mensaje claro.
  const file = (id: number) => path.join(dir, `${id}.webp`);
  return {
    async versions() {
      const out = new Map<number, number>();
      let names: string[];
      try {
        names = fs.readdirSync(dir);
      } catch {
        return out; // aún no hay fotos
      }
      for (const name of names) {
        const m = /^(\d{1,12})\.webp$/.exec(name);
        if (!m) continue;
        try {
          out.set(Number(m[1]), Math.floor(fs.statSync(path.join(dir, name)).mtimeMs));
        } catch {
          /* borrada entre readdir y stat */
        }
      }
      return out;
    },
    async read(id) {
      try {
        return fs.readFileSync(file(id));
      } catch {
        return null;
      }
    },
    async save(id, data) {
      assertPhoto(data);
      fs.mkdirSync(dir, { recursive: true });
      const tmp = `${file(id)}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, file(id)); // reemplazo atómico: nunca se sirve una foto a medio escribir
    },
    async remove(id) {
      fs.rmSync(file(id), { force: true });
    },
  };
}
