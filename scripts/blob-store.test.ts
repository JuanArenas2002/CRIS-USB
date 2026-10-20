// @vitest-environment node
import { beforeEach, vi } from 'vitest';
import { createStores, storeOptionsFromEnv } from './stores';

// Vercel Blob simulado en memoria (misma forma que el SDK: put / get / list / del).
const blobs = new Map<string, { body: Buffer; uploadedAt: Date; access: string }>();
vi.mock('@vercel/blob', () => ({
  put: vi.fn(
    async (pathname: string, body: Buffer | string, o: { access: string; allowOverwrite: boolean }) => {
      if (blobs.has(pathname) && !o.allowOverwrite) throw new Error('existe');
      blobs.set(pathname, { body: Buffer.from(body), uploadedAt: new Date(), access: o.access });
      return { pathname, url: `https://blob/${pathname}` };
    },
  ),
  get: vi.fn(async (pathname: string) => {
    const b = blobs.get(pathname);
    return b ? { stream: new Response(new Uint8Array(b.body)).body } : null;
  }),
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()]
      .filter(([p]) => p.startsWith(prefix))
      .map(([pathname, b]) => ({ pathname, uploadedAt: b.uploadedAt })),
    hasMore: false,
  })),
  del: vi.fn(async (pathname: string) => void blobs.delete(pathname)),
}));

const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);
beforeEach(() => blobs.clear());

test('Blob con token o con store por OIDC; sin Blob: disco en local, error claro en Vercel', async () => {
  expect(createStores({ blobToken: 't' }).kind).toBe('blob');
  expect(createStores({ blobStoreId: 'store_abc' }).kind).toBe('blob');
  expect(createStores({ photosDir: 'data/photos' }).kind).toBe('disk');
  const none = createStores({ onVercel: true });
  expect(none.kind).toBe('none');
  expect(await none.sites.all()).toEqual({});
  await expect(none.photos.save(1, WEBP)).rejects.toThrow('Falta conectar Vercel Blob');
});

test('Blob por OIDC: cada llamada lleva el store y el token que Vercel manda en la petición', async () => {
  const { put } = await import('@vercel/blob');
  const { setOidcToken } = await import('./blob-store');
  setOidcToken('oidc-123');
  await createStores({ blobStoreId: 'store_abc' }).sites.set(3, 'https://ejemplo.co');
  expect(vi.mocked(put).mock.lastCall?.[2]).toMatchObject({ storeId: 'store_abc', oidcToken: 'oidc-123' });
  expect(vi.mocked(put).mock.lastCall?.[2]).not.toHaveProperty('token');
});

test('Blob: fotos se guardan, se versionan, se leen y se quitan', async () => {
  const { photos } = createStores({ blobToken: 't' });
  await expect(photos.save(1, Buffer.from('<svg/>'))).rejects.toThrow('WebP');
  await photos.save(1, WEBP);
  expect(blobs.get('cris/photos/1.webp')?.access).toBe('private');
  expect([...(await photos.versions()).keys()]).toEqual([1]);
  expect(await photos.read(1)).toEqual(WEBP);
  await photos.remove(1);
  expect((await photos.versions()).size).toBe(0);
  expect(await photos.read(1)).toBeNull();
});

test('Blob: mapa en un solo JSON, normalizado; valor vacío quita la entrada', async () => {
  const { sites } = createStores({ blobToken: 't', blobAccess: 'public' });
  expect(await sites.all()).toEqual({});
  expect(await sites.set(14, 'www.ejemplo.co')).toBe('https://www.ejemplo.co/');
  expect(await sites.set(2, 'https://otro.co')).toBe('https://otro.co/');
  expect(await sites.all()).toEqual({ 14: 'https://www.ejemplo.co/', 2: 'https://otro.co/' });
  expect(blobs.get('cris/center-sites.json')?.access).toBe('public');
  await sites.set(14, '');
  expect(await sites.all()).toEqual({ 2: 'https://otro.co/' });
});

test('variables del store con prefijo propio (Vercel deja elegirlo al conectar)', () => {
  expect(storeOptionsFromEnv({ CRIS_READ_WRITE_TOKEN: 'vercel_blob_rw_abc_123' }).blobToken).toBe(
    'vercel_blob_rw_abc_123',
  );
  expect(storeOptionsFromEnv({ FOTOS_STORE_ID: 'store_abc' }).blobStoreId).toBe('store_abc');
  expect(storeOptionsFromEnv({ OTRO_READ_WRITE_TOKEN: 'no-es-de-blob' }).blobToken).toBeUndefined();
});
