// Elige dónde viven fotos y ODS: Vercel Blob si el store está conectado (token o BLOB_STORE_ID, que
// Vercel inyecta al conectarlo); si no, disco (local o servidor propio). En Vercel no hay disco.
import { createBlobOdsStore, createBlobPhotoStore, type BlobAccess } from './blob-store.ts';
import { createDiskOdsStore, type OdsStore } from './ods-store.ts';
import { createDiskPhotoStore, type PhotoStore } from './photo-store.ts';

export const DEFAULT_PHOTOS_DIR = 'data/photos';
export const DEFAULT_ODS_FILE = 'data/ods.json';

export interface StoreOptions {
  photosDir?: string;
  odsFile?: string;
  /** BLOB_READ_WRITE_TOKEN. */
  blobToken?: string;
  /** BLOB_STORE_ID (store conectado por OIDC). */
  blobStoreId?: string;
  /** Tipo del store de Blob ('private' por defecto). */
  blobAccess?: string;
}

/** En Vercel sin Blob: se leen vacíos y guardar explica qué falta (no hay disco donde escribir). */
const NO_BLOB =
  'Falta conectar Vercel Blob al proyecto (Storage → Blob → Connect) y volver a desplegar: ' +
  'en Vercel no hay disco donde guardar fotos ni ODS.';
const unconfigured = (): { photos: PhotoStore; ods: OdsStore } => {
  const fail = async (): Promise<never> => {
    throw new Error(NO_BLOB);
  };
  return {
    photos: { versions: async () => new Map(), read: async () => null, save: fail, remove: fail },
    ods: { all: async () => ({}), set: fail },
  };
};

export function createStores({
  photosDir,
  odsFile,
  blobToken,
  blobStoreId,
  blobAccess,
  onVercel = false,
}: StoreOptions & { onVercel?: boolean } = {}) {
  if (blobToken || blobStoreId) {
    const cfg = {
      token: blobToken || undefined,
      storeId: blobStoreId || undefined,
      access: (blobAccess === 'public' ? 'public' : 'private') as BlobAccess,
    };
    return { kind: 'blob' as const, photos: createBlobPhotoStore(cfg), ods: createBlobOdsStore(cfg) };
  }
  if (onVercel) return { kind: 'none' as const, ...unconfigured() };
  return {
    kind: 'disk' as const,
    photos: createDiskPhotoStore(photosDir || DEFAULT_PHOTOS_DIR),
    ods: createDiskOdsStore(odsFile || DEFAULT_ODS_FILE),
  };
}

/**
 * Al conectar el store, Vercel deja elegir un prefijo para sus variables (`BLOB` por defecto):
 * se aceptan `{PREFIJO}_READ_WRITE_TOKEN` / `{PREFIJO}_STORE_ID`, reconocidos por su valor.
 */
const byPrefix = (env: Record<string, string | undefined>, suffix: string, valuePrefix: string) =>
  Object.entries(env).find(([k, v]) => k.endsWith(suffix) && v?.startsWith(valuePrefix))?.[1];

/** Lee la configuración de almacenamiento de un objeto de entorno (process.env o loadEnv). */
export const storeOptionsFromEnv = (env: Record<string, string | undefined>): StoreOptions => ({
  photosDir: env.CRIS_PHOTOS_DIR,
  odsFile: env.CRIS_ODS_FILE,
  blobToken: env.BLOB_READ_WRITE_TOKEN || byPrefix(env, '_READ_WRITE_TOKEN', 'vercel_blob_rw_'),
  blobStoreId: env.BLOB_STORE_ID || byPrefix(env, '_STORE_ID', 'store_'),
  blobAccess: env.CRIS_BLOB_ACCESS,
});
