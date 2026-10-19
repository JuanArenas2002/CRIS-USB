// Elige dónde viven fotos y ODS: Vercel Blob si hay token (Vercel lo inyecta al conectar el store),
// si no, disco (local o servidor propio).
import { createBlobOdsStore, createBlobPhotoStore, type BlobAccess } from './blob-store.ts';
import { createDiskOdsStore } from './ods-store.ts';
import { createDiskPhotoStore } from './photo-store.ts';

export const DEFAULT_PHOTOS_DIR = 'data/photos';
export const DEFAULT_ODS_FILE = 'data/ods.json';

export interface StoreOptions {
  photosDir?: string;
  odsFile?: string;
  /** BLOB_READ_WRITE_TOKEN. */
  blobToken?: string;
  /** Tipo del store de Blob ('private' por defecto). */
  blobAccess?: string;
}

export function createStores({ photosDir, odsFile, blobToken, blobAccess }: StoreOptions = {}) {
  if (blobToken) {
    const cfg = { token: blobToken, access: (blobAccess === 'public' ? 'public' : 'private') as BlobAccess };
    return { kind: 'blob' as const, photos: createBlobPhotoStore(cfg), ods: createBlobOdsStore(cfg) };
  }
  return {
    kind: 'disk' as const,
    photos: createDiskPhotoStore(photosDir || DEFAULT_PHOTOS_DIR),
    ods: createDiskOdsStore(odsFile || DEFAULT_ODS_FILE),
  };
}

/** Lee la configuración de almacenamiento de un objeto de entorno (process.env o loadEnv). */
export const storeOptionsFromEnv = (env: Record<string, string | undefined>): StoreOptions => ({
  photosDir: env.CRIS_PHOTOS_DIR,
  odsFile: env.CRIS_ODS_FILE,
  blobToken: env.BLOB_READ_WRITE_TOKEN,
  blobAccess: env.CRIS_BLOB_ACCESS,
});
