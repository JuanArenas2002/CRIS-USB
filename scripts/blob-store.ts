// Vercel Blob: fotos y ODS cuando el portal corre en Vercel (las funciones no tienen disco persistente).
// - Fotos: `cris/photos/{id}.webp`. El navegador no las pide a Blob: las sirve el BFF, así el store
//   puede ser privado y la URL del portal no cambia.
// - ODS: un solo `cris/ods.json` con { idGrupo: [ods] }.
// Lecturas con `useCache: false` (sin la caché del CDN de Blob) y una caché corta en memoria por
// instancia, para no gastar operaciones de Blob en cada visita.
// Credenciales, según cómo Vercel conectó el store al proyecto:
// - BLOB_READ_WRITE_TOKEN (token fijo), o
// - BLOB_STORE_ID + OIDC: Vercel manda un token temporal en cada petición (cabecera
//   `x-vercel-oidc-token`, ver vercel-api.ts) y en el build (VERCEL_OIDC_TOKEN).
import { del, get, list, put } from '@vercel/blob';
import { assertPhoto, type PhotoStore } from './photo-store.ts';
import { parseOdsMap, withOds, type OdsMap, type OdsStore } from './ods-store.ts';

export type BlobAccess = 'public' | 'private';
export interface BlobConfig {
  /** BLOB_READ_WRITE_TOKEN. */
  token?: string;
  /** BLOB_STORE_ID (conexión por OIDC). */
  storeId?: string;
  access: BlobAccess;
}

// Último token OIDC recibido (es del proyecto, no del usuario: sirve para cualquier petición).
let oidcToken: string | undefined;
export const setOidcToken = (t: string | undefined) => void (t && (oidcToken = t));

/** Credenciales para cada llamada al SDK. Sin token OIDC propio, el SDK lo busca en el entorno. */
const auth = (cfg: BlobConfig) =>
  cfg.token ? { token: cfg.token } : { storeId: cfg.storeId, ...(oidcToken ? { oidcToken } : {}) };

const PHOTOS = 'cris/photos/';
const ODS_FILE = 'cris/ods.json';
const CACHE_MS = 30 * 1000;

async function readBuffer(pathname: string, cfg: BlobConfig): Promise<Buffer | null> {
  const res = await get(pathname, { access: cfg.access, useCache: false, ...auth(cfg) });
  if (!res || !res.stream) return null;
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

/** Caché de una sola lectura con vencimiento; `reset` tras escribir en esta instancia. */
function memo<T>(load: () => Promise<T>) {
  let entry: { at: number; value: Promise<T> } | null = null;
  return {
    get() {
      if (!entry || Date.now() - entry.at > CACHE_MS) {
        const value = load();
        entry = { at: Date.now(), value };
        value.catch(() => (entry = null)); // un fallo no se queda en caché
      }
      return entry.value;
    },
    reset: () => void (entry = null),
  };
}

export function createBlobPhotoStore(cfg: BlobConfig): PhotoStore {
  const versions = memo(async () => {
    const out = new Map<number, number>();
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PHOTOS, cursor, ...auth(cfg) });
      for (const b of page.blobs) {
        const m = /^cris\/photos\/(\d{1,12})\.webp$/.exec(b.pathname);
        if (m) out.set(Number(m[1]), new Date(b.uploadedAt).getTime());
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  });
  return {
    versions: () => versions.get(),
    read: (id) => readBuffer(`${PHOTOS}${id}.webp`, cfg),
    async save(id, data) {
      assertPhoto(data);
      await put(`${PHOTOS}${id}.webp`, data, {
        access: cfg.access,
        ...auth(cfg),
        contentType: 'image/webp',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      versions.reset();
    },
    async remove(id) {
      await del(`${PHOTOS}${id}.webp`, auth(cfg));
      versions.reset();
    },
  };
}

export function createBlobOdsStore(cfg: BlobConfig): OdsStore {
  const load = async (): Promise<OdsMap> => {
    const buf = await readBuffer(ODS_FILE, cfg).catch(() => null);
    try {
      return buf ? parseOdsMap(JSON.parse(buf.toString('utf8'))) : {};
    } catch {
      return {};
    }
  };
  const cache = memo(load);
  return {
    all: () => cache.get(),
    async set(groupId, ods) {
      const [next, clean] = withOds(await load(), groupId, ods); // sin caché: parte de lo último guardado
      await put(ODS_FILE, JSON.stringify(next, null, 2), {
        access: cfg.access,
        ...auth(cfg),
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      cache.reset();
      return clean;
    },
  };
}
