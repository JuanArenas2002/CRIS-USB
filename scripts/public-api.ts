// BFF público: la única puerta del navegador a Metri-K.
// - Metri-K expone datos personales (cédulas, correos, teléfonos, hashes de contraseña); aquí se
//   proyectan a campos públicos (groups-source.ts / investigators-source.ts) y nada más sale.
// - Búsqueda, filtros y paginación se resuelven en memoria: Metri-K no los ofrece.
// - Solo lectura, salvo las fotos de investigadores (PUT/DELETE) y los ODS de los grupos (PUT),
//   ambos con token de administración.
// Dev/preview: montado como middleware en vite.config.ts.
// Producción: `node scripts/public-api.ts` detrás de nginx (ver README).
import { createHash, timingSafeEqual } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { fetchPublicGroups } from './groups-source.ts';
import { fetchGroupMembers, fetchInvestigatorGroups, fetchInvestigators } from './investigators-source.ts';
import { createOdsStore } from './ods-store.ts';
import { MAX_PHOTO_BYTES, createPhotoStore } from './photo-store.ts';
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
export const DEFAULT_PHOTOS_DIR = 'data/photos';
export const DEFAULT_ODS_FILE = 'data/ods.json';
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
  photosDir = DEFAULT_PHOTOS_DIR,
  odsFile = DEFAULT_ODS_FILE,
  adminToken,
}: { metrikUrl?: string; photosDir?: string; odsFile?: string; adminToken?: string } = {}) {
  const base = metrikUrl.replace(/\/+$/, '');
  const photos = createPhotoStore(photosDir);
  const odsStore = createOdsStore(odsFile);
  const metrikGroups = cached<GroupDetail[]>(() => fetchPublicGroups(`${base}/group`));
  // Los ODS se leen en cada consulta (no pasan por la caché de Metri-K): un cambio se ve al instante.
  const groups = async () => {
    const ods = odsStore.all();
    return (await metrikGroups()).map((g) => ({ ...g, ods: ods[g.id] ?? [] }));
  };
  const directory = cached(() => fetchInvestigators(base));
  const withPhoto = <T extends Author>(a: T): T => ({ ...a, photoUrl: photos.url(a.id) });
  const investigators = async () => (await directory()).authors.map(withPhoto);
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
      res.setHeader('Cache-Control', status === 200 ? 'public, max-age=300' : 'no-store');
      res.end(JSON.stringify(body));
    }

    try {
      const p = url.pathname;
      const sp = url.searchParams;
      const photo = /^\/api\/investigators\/(\d{1,12})\/photo$/.exec(p);
      const groupOds = /^\/api\/groups\/(\d{1,12})\/ods$/.exec(p);

      // ── Escritura: fotos y ODS, con token ─────────────────────────────────────────────
      if (req.method === 'PUT' || req.method === 'DELETE') {
        if (!photo && !(groupOds && req.method === 'PUT'))
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
          return send(200, { ods: odsStore.set(id, list) });
        }
        const id = Number(photo![1]);
        if (!(await investigators()).some((a) => a.id === id)) return send(404, { detail: 'No encontrado' });
        if (req.method === 'DELETE') {
          photos.remove(id);
          return send(200, { photoUrl: null });
        }
        const body = await readBody(req, MAX_PHOTO_BYTES);
        if (!body) return send(413, { detail: 'La foto supera 1 MB' });
        try {
          photos.save(id, body);
        } catch (err) {
          return send(400, { detail: (err as Error).message });
        }
        return send(200, { photoUrl: photos.url(id) });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { detail: 'Método no permitido' });

      if (photo) {
        const data = photos.read(Number(photo[1]));
        if (!data) return send(404, { detail: 'Sin foto' });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', sp.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache');
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
              groups: (await groupsOf(a.id)).map((g) => ({ ...g, ods: odsStore.get(g.id) })),
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
      return send(404, { detail: 'No encontrado' });
    } catch {
      return send(502, { detail: 'Servicio de datos no disponible' });
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { CRIS_METRIK_URL, CRIS_PHOTOS_DIR, CRIS_ODS_FILE, CRIS_ADMIN_TOKEN, PORT = '8787' } = process.env;
  http
    .createServer(
      createPublicApi({
        metrikUrl: CRIS_METRIK_URL,
        photosDir: CRIS_PHOTOS_DIR,
        odsFile: CRIS_ODS_FILE,
        adminToken: CRIS_ADMIN_TOKEN,
      }),
    )
    .listen(Number(PORT), '127.0.0.1', () => console.log(`API pública en http://127.0.0.1:${PORT}/api/`));
}
