// Fotos de investigadores, logos de centros y fotos de proyectos: misma validación (WebP ≤ 1 MB) y mismo tipo
// de almacenamiento. GET público; PUT/PATCH/DELETE con token (las de proyecto, además con la contraseña del centro).
import {
  MAX_PHOTO_BYTES,
  MAX_PROJECT_GALLERY,
  logoUrl,
  photoUrl,
  projectPhotoKey,
  projectPhotoUrl,
} from '../../photo-store.ts';
import type { ApiContext } from '../context.ts';
import { readBody } from '../http.ts';
import type { RequestContext, Route } from '../router.ts';
import { projectAccess } from './center-access.ts';

interface ImageTarget {
  store: ApiContext['photos'];
  id: number;
  key: string;
  url: (id: number, version: number) => string;
  exists: (id: number) => Promise<boolean>;
}

function serve({ res, sp, send }: RequestContext, target: ImageTarget) {
  return target.store.read(target.id).then((data) => {
    if (!data) return send(404, { detail: 'Sin imagen' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/webp');
    // Con ?v la URL cambia en cada imagen nueva: el navegador y el CDN la guardan para siempre.
    res.setHeader(
      'Cache-Control',
      sp.has('v') ? 'public, max-age=31536000, s-maxage=31536000, immutable' : 'no-cache',
    );
    return res.end(data);
  });
}

async function write({ req, send }: RequestContext, { store, id, key, url, exists }: ImageTarget) {
  if (!(await exists(id))) return send(404, { detail: 'No encontrado' });
  if (req.method === 'DELETE') {
    await store.remove(id);
    return send(200, { [key]: null });
  }
  const body = await readBody(req, MAX_PHOTO_BYTES);
  if (!body) return send(413, { detail: 'La imagen supera 1 MB' });
  try {
    await store.save(id, body);
  } catch (err) {
    const bad = err instanceof RangeError || err instanceof TypeError;
    return send(bad ? 400 : 500, { detail: (err as Error).message });
  }
  const version = (await store.versions()).get(id);
  return send(200, { [key]: version === undefined ? null : url(id, version) });
}

/** Un recurso con imagen: su ruta pública (GET) y la de administración (escritura). */
function imageResource(
  match: RegExp,
  target: (ctx: ApiContext, m: RegExpExecArray) => ImageTarget,
  /** Fotos de proyectos: exige la contraseña del centro antes de escribir. */
  projectOf?: (m: RegExpExecArray) => number,
) {
  const publicRoute: Route = { match, handler: (rc, m) => serve(rc, target(rc.ctx, m)) };
  const adminRoute: Route = {
    match,
    methods: ['PUT', 'PATCH', 'DELETE'],
    async handler(rc, m) {
      if (projectOf && !(await projectAccess(rc, projectOf(m)))) return;
      return write(rc, target(rc.ctx, m));
    },
  };
  return { publicRoute, adminRoute };
}

const investigatorPhoto = imageResource(/^\/api\/investigators\/(\d{1,12})\/photo$/, (ctx, m) => ({
  store: ctx.photos,
  id: Number(m[1]),
  key: 'photoUrl',
  url: photoUrl,
  exists: async (id) => (await ctx.investigators()).some((a) => a.id === id),
}));

const centerLogo = imageResource(/^\/api\/centers\/(\d{1,12})\/logo$/, (ctx, m) => ({
  store: ctx.logos,
  id: Number(m[1]),
  key: 'logoUrl',
  url: logoUrl,
  exists: async (id) => (await ctx.metrikCenters()).some((c) => c.id === id && c.active),
}));

const projectPhoto = imageResource(
  /^\/api\/projects\/(\d{1,10})\/photos\/(\d{1,2})$/,
  (ctx, m) => ({
    store: ctx.projectPhotos,
    id: projectPhotoKey(Number(m[1]), Number(m[2])),
    key: 'photoUrl',
    url: projectPhotoUrl,
    exists: async (key) =>
      key % 100 <= MAX_PROJECT_GALLERY &&
      (await ctx.metrikProjects()).some((x) => x.id === Math.floor(key / 100)),
  }),
  (m) => Number(m[1]),
);

export const imageAdminRoutes = [investigatorPhoto, centerLogo, projectPhoto].map((r) => r.adminRoute);
export const imagePublicRoutes = [investigatorPhoto, centerLogo, projectPhoto].map((r) => r.publicRoute);
