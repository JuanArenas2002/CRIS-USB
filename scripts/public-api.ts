// BFF público: la única puerta del navegador a Metri-K.
// - Metri-K expone datos personales (cédulas, correos, teléfonos, hashes de contraseña); aquí se
//   proyectan a campos públicos (groups-source.ts / investigators-source.ts) y nada más sale.
// - Búsqueda, filtros y paginación se resuelven en memoria: Metri-K no los ofrece.
// - Solo lectura, salvo las fotos de investigadores y los logos de centros (PUT/DELETE), los ODS de
//   los grupos y la página oficial de los centros (PUT), todo con token de administración.
// Dev/preview: montado como middleware en vite.config.ts.
// Producción: `node scripts/public-api.ts` detrás de nginx (ver README).
import { createHash, timingSafeEqual } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { fetchPublicCenters, fetchResolutionPdf } from './centers-source.ts';
import { fetchPublicGroups } from './groups-source.ts';
import { fetchGroupMembers, fetchInvestigatorGroups, fetchInvestigators } from './investigators-source.ts';
import { MAX_PHOTO_BYTES, logoUrl, photoUrl } from './photo-store.ts';
import { normalizeWebsite } from './ods-store.ts';
import { createStores, storeOptionsFromEnv, type StoreOptions } from './stores.ts';
import { summarizeCenter, type CenterDetail } from '../src/domain/centers/center.ts';
import { summarizeGroup, type GroupDetail } from '../src/domain/groups/group.ts';
import { isOdsId } from '../src/domain/ods/ods.ts';
import {
  AUTHOR_CATEGORIES,
  authorStats,
  featuredAuthors,
  queryAuthors,
  type Author,
  type AuthorCategoryId,
  type GroupRef,
} from '../src/domain/authors/author.ts';

export const DEFAULT_METRIK_URL = 'https://metrik.unisimon.edu.co/back/api';
export { DEFAULT_ODS_FILE, DEFAULT_PHOTOS_DIR } from './stores.ts';
const TTL_MS = 10 * 60 * 1000;
const MAX_ODS_BYTES = 1024;
const MAX_PAGE_SIZE = 100;

/**
 * Caché con respaldo: si la fuente falla, se sirve la última copia buena.
 * ponytail: en memoria de un solo proceso; basta para ~600 investigadores y ~50 grupos.
 */
function cached<T>(load: () => Promise<T>) {
  let entry: { at: number; data: T } | null = null;
  return async (): Promise<T> => {
    if (entry && Date.now() - entry.at < TTL_MS) return entry.data;
    try {
      entry = { at: Date.now(), data: await load() };
    } catch (err) {
      if (!entry) throw err;
    }
    return entry.data;
  };
}

/** Comparación en tiempo constante (sha256 iguala longitudes). */
const sameSecret = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

async function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export function createPublicApi({
  metrikUrl = DEFAULT_METRIK_URL,
  adminToken,
  ...storage
}: { metrikUrl?: string; adminToken?: string; onVercel?: boolean } & StoreOptions = {}) {
  const base = metrikUrl.replace(/\/+$/, '');
  const { photos, ods: odsStore, logos, sites } = createStores(storage);
  const metrikGroups = cached<GroupDetail[]>(() => fetchPublicGroups(`${base}/group`));
  const metrikCenters = cached<CenterDetail[]>(() => fetchPublicCenters(base));
  const centers = async () => {
    const [v, site] = await Promise.all([logos.versions(), sites.all()]);
    return (await metrikCenters()).map((c) => {
      const version = v.get(c.id);
      return {
        ...c,
        logoUrl: version === undefined ? null : logoUrl(c.id, version),
        website: site[c.id] ?? null,
      };
    });
  };
  // Fotos, logos y ODS no pasan por la caché de Metri-K: un cambio del admin se ve al instante.
  const groups = async () => {
    const ods = await odsStore.all();
    return (await metrikGroups()).map((g) => ({ ...g, ods: ods[g.id] ?? [] }));
  };
  const directory = cached(() => fetchInvestigators(base));
  const photoUrls = async () => {
    const v = await photos.versions();
    return <T extends Author>(a: T): T => {
      const version = v.get(a.id);
      return { ...a, photoUrl: version === undefined ? null : photoUrl(a.id, version) };
    };
  };
  const investigators = async () => {
    const withPhoto = await photoUrls();
    return (await directory()).authors.map(withPhoto);
  };
  const memberships = new Map<number, () => Promise<GroupRef[]>>();
  const groupsOf = (id: number) => {
    if (!memberships.has(id))
      memberships.set(
        id,
        cached(() => fetchInvestigatorGroups(base, id)),
      );
    return memberships.get(id)!();
  };

  const groupMembers = new Map<number, () => Promise<Author[]>>();
  const membersOf = async (groupId: number) => {
    if (!groupMembers.has(groupId))
      groupMembers.set(
        groupId,
        cached(() => fetchGroupMembers(base, groupId)),
      );
    // Los integrantes publicados heredan las métricas del perfil (pubs e índice h en su tarjeta).
    const published = new Map((await investigators()).map((a) => [a.id, a]));
    const withPhoto = await photoUrls();
    return (await groupMembers.get(groupId)!()).map((m) => ({
      ...withPhoto(m),
      metrics: published.get(m.id)?.metrics ?? m.metrics,
      profilePublished: published.has(m.id),
    }));
  };

  return async function handler(req: IncomingMessage, res: ServerResponse, next?: () => void) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next ? next() : send(404, { detail: 'No encontrado' });

    function send(status: number, body: unknown) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      // El navegador siempre revalida; el CDN (Vercel) guarda 30 s. Así lo que cambie el admin
      // (fotos, ODS) se ve en menos de un minuto sin consultar Metri-K en cada visita.
      res.setHeader(
        'Cache-Control',
        status === 200 ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' : 'no-store',
      );
      res.end(JSON.stringify(body));
    }

    try {
      const p = url.pathname;
      const sp = url.searchParams;
      const photo = /^\/api\/investigators\/(\d{1,12})\/photo$/.exec(p);
      const logo = /^\/api\/centers\/(\d{1,12})\/logo$/.exec(p);
      const groupOds = /^\/api\/groups\/(\d{1,12})\/ods$/.exec(p);
      const site = /^\/api\/centers\/(\d{1,12})\/website$/.exec(p);
      // Fotos y logos: misma validación (WebP ≤ 1 MB) y mismo tipo de almacenamiento.
      const image = photo
        ? {
            store: photos,
            id: Number(photo[1]),
            key: 'photoUrl',
            url: photoUrl,
            exists: async (id: number) => (await investigators()).some((a) => a.id === id),
          }
        : logo
          ? {
              store: logos,
              id: Number(logo[1]),
              key: 'logoUrl',
              url: logoUrl,
              exists: async (id: number) => (await metrikCenters()).some((c) => c.id === id && c.active),
            }
          : null;

      // ── Escritura: fotos, logos, ODS y páginas oficiales, con token ───────────────────
      if (req.method === 'PUT' || req.method === 'DELETE') {
        if (!image && !((groupOds || site) && req.method === 'PUT'))
          return send(405, { detail: 'Método no permitido' });
        if (!adminToken)
          return send(503, { detail: 'Administración deshabilitada (falta CRIS_ADMIN_TOKEN)' });
        const token = req.headers['x-admin-token'];
        if (typeof token !== 'string' || !sameSecret(token, adminToken))
          return send(401, { detail: 'Token de administración inválido' });
        if (groupOds) {
          const id = Number(groupOds[1]);
          if (!(await metrikGroups()).some((g) => g.id === id && g.active))
            return send(404, { detail: 'No encontrado' });
          const body = await readBody(req, MAX_ODS_BYTES);
          let parsed: unknown;
          try {
            parsed = body && JSON.parse(body.toString('utf8'));
          } catch {
            parsed = null;
          }
          const list = (parsed as { ods?: unknown } | null)?.ods;
          if (!Array.isArray(list) || list.length > 17 || !list.every(isOdsId))
            return send(400, { detail: 'Se espera { "ods": [números del 1 al 17] }' });
          try {
            return send(200, { ods: (await odsStore.set(id, list)) ?? [] });
          } catch (err) {
            return send(500, { detail: `No se pudieron guardar los ODS: ${(err as Error).message}` });
          }
        }
        if (site) {
          const id = Number(site[1]);
          if (!(await metrikCenters()).some((c) => c.id === id && c.active))
            return send(404, { detail: 'No encontrado' });
          const body = await readBody(req, MAX_ODS_BYTES);
          let website: unknown;
          try {
            website = body && (JSON.parse(body.toString('utf8')) as { website?: unknown }).website;
          } catch {
            website = undefined;
          }
          // null o "" quitan la página; cualquier otro valor debe ser una URL http(s) válida.
          if (!(website === null || website === '' || normalizeWebsite(website)))
            return send(400, { detail: 'Se espera { "website": "https://…" } o { "website": null }' });
          try {
            return send(200, { website: await sites.set(id, website) });
          } catch (err) {
            return send(500, { detail: `No se pudo guardar la página: ${(err as Error).message}` });
          }
        }
        const { store, id, key, url: imageUrl, exists } = image!;
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
        return send(200, { [key]: version === undefined ? null : imageUrl(id, version) });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { detail: 'Método no permitido' });

      if (image) {
        const data = await image.store.read(image.id);
        if (!data) return send(404, { detail: 'Sin imagen' });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/webp');
        // Con ?v la URL cambia en cada imagen nueva: el navegador y el CDN la guardan para siempre.
        res.setHeader(
          'Cache-Control',
          sp.has('v') ? 'public, max-age=31536000, s-maxage=31536000, immutable' : 'no-cache',
        );
        return res.end(data);
      }

      if (p === '/api/investigators') {
        const cat = sp.get('cat');
        const page = Number(sp.get('page')) || 1;
        const size = Number(sp.get('size')) || 12;
        return send(
          200,
          queryAuthors(await investigators(), {
            search: sp.get('q') ?? undefined,
            category: AUTHOR_CATEGORIES.some((c) => c.id === cat) ? (cat as AuthorCategoryId) : undefined,
            groupId: Number(sp.get('group')) || undefined,
            page: Math.max(1, Math.floor(page)),
            pageSize: Math.min(Math.max(1, Math.floor(size)), MAX_PAGE_SIZE),
          }),
        );
      }
      if (p === '/api/investigators/stats') return send(200, authorStats(await investigators()));
      if (p === '/api/investigators/featured') return send(200, featuredAuthors(await investigators()));
      const inv = /^\/api\/investigators\/(\d{1,12})$/.exec(p);
      if (inv) {
        const { production } = await directory();
        const a = (await investigators()).find((x) => x.id === Number(inv[1]));
        return a
          ? send(200, {
              ...a,
              // Cada grupo lleva sus ODS: el perfil muestra los que el investigador hereda de sus grupos.
              groups: await (async () => {
                const ods = await odsStore.all();
                return (await groupsOf(a.id)).map((g) => ({ ...g, ods: ods[g.id] ?? [] }));
              })(),
              production: production.get(a.id) ?? null,
            })
          : send(404, { detail: 'No encontrado' });
      }

      if (p === '/api/groups') return send(200, (await groups()).map(summarizeGroup));
      const members = /^\/api\/groups\/(\d{1,12})\/members$/.exec(p);
      if (members) {
        const id = Number(members[1]);
        if (!(await groups()).some((g) => g.id === id && g.active))
          return send(404, { detail: 'No encontrado' });
        return send(200, await membersOf(id));
      }
      const grp = /^\/api\/groups\/(\d{1,12})$/.exec(p);
      if (grp) {
        const g = (await groups()).find((x) => x.id === Number(grp[1]));
        return g ? send(200, g) : send(404, { detail: 'No encontrado' });
      }

      if (p === '/api/centers') return send(200, (await centers()).map(summarizeCenter));
      const ctr = /^\/api\/centers\/(\d{1,12})$/.exec(p);
      if (ctr) {
        const c = (await centers()).find((x) => x.id === Number(ctr[1]));
        return c ? send(200, c) : send(404, { detail: 'No encontrado' });
      }
      // PDF de una resolución (solo de centros activos). Bajo demanda: Metri-K lo trae en base64.
      const resolution = /^\/api\/centers\/(\d{1,12})\/resolutions\/(\d{1,12})$/.exec(p);
      if (resolution) {
        const centerId = Number(resolution[1]);
        const c = (await centers()).find((x) => x.id === centerId && x.active);
        if (!c?.resolutions.some((r) => r.id === Number(resolution[2]) && r.hasFile))
          return send(404, { detail: 'No encontrado' });
        const file = await fetchResolutionPdf(base, centerId, Number(resolution[2]));
        if (!file) return send(404, { detail: 'No encontrado' });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${file.name}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return res.end(req.method === 'HEAD' ? undefined : file.pdf);
      }
      return send(404, { detail: 'No encontrado' });
    } catch {
      return send(502, { detail: 'Servicio de datos no disponible' });
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { CRIS_METRIK_URL, CRIS_ADMIN_TOKEN, PORT = '8787', HOST = '127.0.0.1' } = process.env;
  http
    .createServer(
      createPublicApi({
        metrikUrl: CRIS_METRIK_URL,
        adminToken: CRIS_ADMIN_TOKEN,
        ...storeOptionsFromEnv(process.env),
      }),
    )
    .listen(Number(PORT), HOST, () => console.log(`API pública en http://${HOST}:${PORT}/api/`));
}
