// Elige dónde viven fotos, logos, páginas oficiales de centros, ranking y publicaciones: Vercel Blob si el store está conectado (token o BLOB_STORE_ID, que
// Vercel inyecta al conectarlo); si no, disco (local o servidor propio). En Vercel no hay disco.
import { createBlobMapStore, createBlobPhotoStore, type BlobAccess } from './blob-store.ts';
import {
  createDiskMapStore,
  normalizeFlag,
  normalizePublication,
  normalizeRanking,
  normalizeWebsite,
  type MapStore,
} from './ods-store.ts';
import { createDiskPhotoStore, type PhotoStore } from './photo-store.ts';
import type { AuthorRanking } from '../src/domain/authors/author.ts';
import type { StoredPublication } from '../src/domain/publications/publication.ts';

export const DEFAULT_PHOTOS_DIR = 'data/photos';
export const DEFAULT_LOGOS_DIR = 'data/logos';
export const DEFAULT_SITES_FILE = 'data/center-sites.json';
export const DEFAULT_RANKING_FILE = 'data/ranking.json';
export const DEFAULT_RANKING_HIDDEN_FILE = 'data/ranking-hidden.json';
export const DEFAULT_PUBLICATIONS_FILE = 'data/publications.json';

export interface StoreOptions {
  photosDir?: string;
  logosDir?: string;
  sitesFile?: string;
  rankingFile?: string;
  /** Investigadores del ranking ocultos en /admin/ranking (sobrevive a cargar otro Excel). */
  rankingHiddenFile?: string;
  /** Ranking de publicaciones Scopus de /admin/produccion, por puesto. */
  publicationsFile?: string;
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
  'en Vercel no hay disco donde guardar fotos, logos ni el ranking.';
const unconfigured = (): {
  photos: PhotoStore;
  logos: PhotoStore;
  sites: MapStore<string>;
  ranking: MapStore<AuthorRanking>;
  rankingHidden: MapStore<true>;
  publications: MapStore<StoredPublication>;
} => {
  const fail = async (): Promise<never> => {
    throw new Error(NO_BLOB);
  };
  const images: PhotoStore = {
    versions: async () => new Map(),
    read: async () => null,
    save: fail,
    remove: fail,
  };
  return {
    photos: images,
    logos: images,
    sites: { all: async () => ({}), set: fail, replace: fail },
    ranking: { all: async () => ({}), set: fail, replace: fail },
    rankingHidden: { all: async () => ({}), set: fail, replace: fail },
    publications: { all: async () => ({}), set: fail, replace: fail },
  };
};

export function createStores({
  photosDir,
  logosDir,
  sitesFile,
  rankingFile,
  rankingHiddenFile,
  publicationsFile,
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
    return {
      kind: 'blob' as const,
      photos: createBlobPhotoStore(cfg),
      logos: createBlobPhotoStore(cfg, 'cris/logos/'),
      sites: createBlobMapStore(cfg, 'cris/center-sites.json', normalizeWebsite),
      ranking: createBlobMapStore(cfg, 'cris/ranking.json', normalizeRanking),
      rankingHidden: createBlobMapStore(cfg, 'cris/ranking-hidden.json', normalizeFlag),
      publications: createBlobMapStore(cfg, 'cris/publications.json', normalizePublication),
    };
  }
  if (onVercel) return { kind: 'none' as const, ...unconfigured() };
  return {
    kind: 'disk' as const,
    photos: createDiskPhotoStore(photosDir || DEFAULT_PHOTOS_DIR),
    logos: createDiskPhotoStore(logosDir || DEFAULT_LOGOS_DIR),
    sites: createDiskMapStore(sitesFile || DEFAULT_SITES_FILE, normalizeWebsite),
    ranking: createDiskMapStore(rankingFile || DEFAULT_RANKING_FILE, normalizeRanking),
    rankingHidden: createDiskMapStore(rankingHiddenFile || DEFAULT_RANKING_HIDDEN_FILE, normalizeFlag),
    publications: createDiskMapStore(publicationsFile || DEFAULT_PUBLICATIONS_FILE, normalizePublication),
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
  logosDir: env.CRIS_LOGOS_DIR,
  sitesFile: env.CRIS_CENTER_SITES_FILE,
  rankingFile: env.CRIS_RANKING_FILE,
  rankingHiddenFile: env.CRIS_RANKING_HIDDEN_FILE,
  publicationsFile: env.CRIS_PUBLICATIONS_FILE,
  blobToken: env.BLOB_READ_WRITE_TOKEN || byPrefix(env, '_READ_WRITE_TOKEN', 'vercel_blob_rw_'),
  blobStoreId: env.BLOB_STORE_ID || byPrefix(env, '_STORE_ID', 'store_'),
  blobAccess: env.CRIS_BLOB_ACCESS,
});
