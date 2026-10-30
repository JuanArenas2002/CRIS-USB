// BFF público: la única puerta del navegador a Metri-K.
// - Metri-K expone datos personales (cédulas, correos, teléfonos, hashes de contraseña); aquí se
//   proyectan a campos públicos (groups-source.ts / investigators-source.ts) y nada más sale.
// - Búsqueda, filtros y paginación se resuelven en memoria: Metri-K no los ofrece.
// - Solo lectura, salvo las fotos de investigadores y los logos de centros (PUT/DELETE), la página
//   oficial de los centros (PUT), el ranking USB y el de publicaciones (PUT/DELETE), todo con token
//   de administración.
//   Los ODS de grupos y centros vienen de Metri-K.
// Dev/preview: montado como middleware en vite.config.ts.
// Producción: `node scripts/public-api.ts` detrás de nginx (ver README).
import { createHash, timingSafeEqual } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { fetchInvestigatorCenters, fetchPublicCenters, fetchResolutionPdf } from './centers-source.ts';
import { fetchCollaborationMap, fetchCountryPublications } from './collaboration-source.ts';
import { FIRST_RELATIONS_YEAR } from '../src/domain/relations/relations.ts';
import { fetchPublicGroups, mapLimit } from './groups-source.ts';
import { fetchPublicProjects, fetchStaff, removeStaff, saveStaff, toStaff } from './projects-source.ts';
import { MIN_CENTER_PASSWORD, hashPassword, verifyPassword } from './center-password.ts';
import { projectsOfCenter } from '../src/domain/projects/project.ts';
import {
  fetchGroupMembers,
  fetchInvestigatorGroups,
  fetchInvestigators,
  normalizeDocument,
  publishAuthors,
  publishWithTiers,
} from './investigators-source.ts';
import {
  MAX_PHOTO_BYTES,
  MAX_PROJECT_GALLERY,
  logoUrl,
  photoUrl,
  projectPhotoKey,
  projectPhotoUrl,
  withProjectPhotos,
} from './photo-store.ts';
import { normalizePublication, normalizeRanking, normalizeWebsite } from './ods-store.ts';
import { createStores, storeOptionsFromEnv, type StoreOptions } from './stores.ts';
import { summarizeCenter, type CenterDetail, type CenterRef } from '../src/domain/centers/center.ts';
import { hasPublicDetail, summarizeGroup, type GroupDetail } from '../src/domain/groups/group.ts';
import {
  AUTHOR_CATEGORIES,
  authorStats,
  featuredAuthors,
  queryAuthors,
  type Author,
  type AuthorCategoryId,
  type GroupRef,
  withRankingCenter,
  isRankingTier,
  type RankingTier,
} from '../src/domain/authors/author.ts';
import {
  PUBLICATION_SORTS,
  QUARTILES,
  publicationStats,
  queryPublications,
  withAuthors,
  type PublicationSort,
  type Quartile,
} from '../src/domain/publications/publication.ts';

export const DEFAULT_METRIK_URL = 'https://metrik.unisimon.edu.co/back/api';
/** API de colaboración (relacionamiento). Sin `/api` al final. */
export const DEFAULT_COLLAB_URL = 'https://metrik.unisimon.edu.co/etl';
export { DEFAULT_PHOTOS_DIR } from './stores.ts';
const TTL_MS = 10 * 60 * 1000;
const MAX_JSON_BYTES = 1024;
// ~300 filas × ~100 bytes; holgura para miles.
const MAX_RANKING_BYTES = 1024 * 1024;
const MAX_PAGE_SIZE = 100;
// ~1200 publicaciones con resumen ≈ 2,5 MB. Vercel no acepta cuerpos de más de 4,5 MB.
const MAX_PUBLICATIONS_BYTES = 4 * 1024 * 1024;

/**
 * Caché con respaldo: si la fuente falla, se sirve la última copia buena.
 * ponytail: en memoria de un solo proceso; basta para ~600 investigadores y ~50 grupos.
 */
function cached<T>(load: () => Promise<T>) {
  let entry: { at: number; data: T } | null = null;
  const get = async (): Promise<T> => {
    if (entry && Date.now() - entry.at < TTL_MS) return entry.data;
    try {
      entry = { at: Date.now(), data: await load() };
    } catch (err) {
      if (!entry) throw err;
    }
    return entry.data;
  };
  /** Tras escribir en Metri-K: la próxima lectura va a la fuente. */
  return Object.assign(get, { reset: () => void (entry = null) });
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
  collabUrl = DEFAULT_COLLAB_URL,
  adminToken,
  compress = false,
  ...storage
}: {
  metrikUrl?: string;
  /** API de colaboración (mapa de relacionamiento). */
  collabUrl?: string;
  adminToken?: string;
  onVercel?: boolean;
  /** gzip propio del JSON: solo en el servidor propio (Vercel y Vite ya tienen su capa delante). */
  compress?: boolean;
} & StoreOptions = {}) {
  const base = metrikUrl.replace(/\/+$/, '');
  const {
    photos,
    logos,
    projectPhotos,
    sites,
    centerPasswords,
    ranking: rankingStore,
    rankingHidden,
    rankingTiers,
    publications: publicationStore,
  } = createStores(storage);
  const metrikGroups = cached<GroupDetail[]>(() => fetchPublicGroups(`${base}/group`));
  const metrikCenters = cached<CenterDetail[]>(() => fetchPublicCenters(base));
  const metrikProjects = cached(() => fetchPublicProjects(base));
  // Fotos fuera de la caché, como los logos: lo que sube el admin se ve al instante.
  // Relacionamiento: un mapa por año (y uno con todos), cacheado 10 min como lo demás.
  const collabBase = collabUrl.replace(/\/+$/, '');
  const collabByYear = new Map<number, () => ReturnType<typeof fetchCollaborationMap>>();
  const collaboration = (year: number | null) => {
    const key = year ?? 0;
    if (!collabByYear.has(key))
      collabByYear.set(
        key,
        cached(() => fetchCollaborationMap(collabBase, year)),
      );
    return collabByYear.get(key)!();
  };
  const countryPubs = new Map<string, () => ReturnType<typeof fetchCountryPublications>>();
  /** Publicaciones con un país (ISO3 → nombre Scopus del mapa del mismo año); null si no está. */
  const publicationsWith = async (iso3: string, year: number | null) => {
    const country = (await collaboration(year)).countries.find((c) => c.iso3 === iso3);
    if (!country) return null;
    const key = `${iso3}:${year ?? ''}`;
    if (!countryPubs.has(key))
      countryPubs.set(
        key,
        cached(() => fetchCountryPublications(collabBase, country.country, year)),
      );
    return countryPubs.get(key)!();
  };
  const projects = async () => {
    const v = await projectPhotos.versions();
    return (await metrikProjects()).map((p) => withProjectPhotos(p, v));
  };
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
  // Grupos con sus ODS, ambos de Metri-K (caché). Fotos y logos no pasan por la caché: un cambio del
  // admin se ve al instante.
  const groups = metrikGroups;
  const directory = cached(() => fetchInvestigators(base));
  const photoUrls = async () => {
    const v = await photos.versions();
    return <T extends Author>(a: T): T => {
      const version = v.get(a.id);
      return { ...a, photoUrl: version === undefined ? null : photoUrl(a.id, version) };
    };
  };
  // Publicados según el ranking USB (o los seleccionados, sin ranking); cada uno con sus centros
  // (tarjeta y perfil) y el logo del portal. El ranking no pasa por la caché: un Excel nuevo se ve
  // al instante.
  // ponytail: una consulta a Metri-K por investigador (cacheada 10 min, 8 a la vez); con cientos de
  // publicados, la primera visita tras vencer la caché tarda unos segundos. Pedir a Metri-K un
  // endpoint masivo de centros si molesta.
  const investigators = async () => {
    const [withPhoto, v, ranking, hidden, top12, top60] = await Promise.all([
      photoUrls(),
      logos.versions(),
      rankingStore.all(),
      rankingHidden.all(),
      rankingTiers.top12.all(),
      rankingTiers.top60.all(),
    ]);
    const withLogo = <C extends { id: number }>(c: C) => {
      const version = v.get(c.id);
      return { ...c, logoUrl: version === undefined ? null : logoUrl(c.id, version) };
    };
    const known: CenterRef[] = (await metrikCenters().catch(() => []))
      .filter((c) => c.active)
      .map(({ id, code, acronym, name }) => withLogo({ id, code, acronym, name }));
    const published = publishWithTiers(await directory(), ranking, hidden, { top12, top60 });
    return mapLimit(published, 8, async (a) =>
      withRankingCenter(
        {
          ...withPhoto(a),
          centers: (await centersOf(a.id).catch((): CenterRef[] => [])).map(withLogo),
        },
        known,
      ),
    );
  };
  // Ranking de publicaciones con sus autores de Metri-K; como el ranking USB, sin caché propia.
  const publications = async () => {
    const [stored, dir, ranking, hidden] = await Promise.all([
      publicationStore.all(),
      directory(),
      rankingStore.all(),
      rankingHidden.all(),
    ]);
    return withAuthors(
      Object.values(stored),
      dir.byEid,
      new Map(dir.authors.map((a) => [a.id, a.name])),
      new Set(publishAuthors(dir, ranking, hidden).map((a) => a.id)),
    );
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
  const centerLinks = new Map<number, () => Promise<CenterRef[]>>();
  const centersOf = (id: number) => {
    if (!centerLinks.has(id))
      centerLinks.set(
        id,
        cached(() => fetchInvestigatorCenters(base, id)),
      );
    return centerLinks.get(id)!();
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

    /** `privateBody`: respuesta del admin (con token) que ningún CDN ni navegador debe guardar. */
    function send(status: number, body: unknown, privateBody = false) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      // El navegador siempre revalida; el CDN (Vercel) guarda 30 s. Así lo que cambie el admin
      // (fotos, ODS) se ve en menos de un minuto sin consultar Metri-K en cada visita.
      res.setHeader(
        'Cache-Control',
        status === 200 && !privateBody
          ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=60'
          : 'no-store',
      );
      const json = JSON.stringify(body);
      // JSON comprimido (los listados pesan decenas de KB); los pequeños no compensan.
      if (compress && json.length > 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        return void res.end(gzipSync(json));
      }
      res.end(json);
    }

    try {
      const p = url.pathname;
      const sp = url.searchParams;
      const photo = /^\/api\/investigators\/(\d{1,12})\/photo$/.exec(p);
      const logo = /^\/api\/centers\/(\d{1,12})\/logo$/.exec(p);
      const site = /^\/api\/centers\/(\d{1,12})\/website$/.exec(p);
      const projectPhoto = /^\/api\/projects\/(\d{1,10})\/photos\/(\d{1,2})$/.exec(p);
      const centerPassword = /^\/api\/centers\/(\d{1,12})\/password$/.exec(p);
      // Comprobar la contraseña de un centro antes de mostrar sus proyectos en el admin.
      const centerAccess = /^\/api\/centers\/(\d{1,12})\/access$/.exec(p);
      // Equipo del proyecto (Metri-K `personal`): GET lista con cédulas, PATCH agrega, DELETE quita.
      const staff = /^\/api\/projects\/(\d{1,10})\/personal$/.exec(p);
      const staffOne = /^\/api\/projects\/(\d{1,10})\/personal\/([^/]{1,40})$/.exec(p);
      // Fotos, logos y fotos de proyectos: misma validación (WebP ≤ 1 MB) y mismo tipo de almacenamiento.
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
          : projectPhoto
            ? {
                store: projectPhotos,
                id: projectPhotoKey(Number(projectPhoto[1]), Number(projectPhoto[2])),
                key: 'photoUrl',
                url: projectPhotoUrl,
                exists: async (key: number) =>
                  key % 100 <= MAX_PROJECT_GALLERY &&
                  (await metrikProjects()).some((x) => x.id === Math.floor(key / 100)),
              }
            : null;

      // Ranking general (/api/ranking) o el de un apartado (/api/ranking/top12, /api/ranking/top60).
      const rankingTier = /^\/api\/ranking\/(top12|top60)$/.exec(p)?.[1] as RankingTier | undefined;
      const rankingUpload = p === '/api/ranking' || !!rankingTier;
      const rankingEntry = /^\/api\/ranking\/(\d{1,12})$/.exec(p);
      // Varios a la vez («Activar / Desactivar todos» en el admin): una sola escritura.
      const rankingBulk = p === '/api/ranking/visibility';
      // Lista del ranking para el admin: nombres y puestos de todos (incluidos los ocultos).
      const adminRead = (p === '/api/ranking' || centerAccess || staff) && req.method === 'GET';
      const publicationsUpload = p === '/api/publications';

      // ── Escritura (y lectura del admin): fotos, logos, ODS, páginas y ranking, con token ──
      if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE' || adminRead) {
        if (
          !adminRead &&
          !(staff && req.method === 'PATCH') &&
          !(staffOne && req.method === 'DELETE') &&
          !image &&
          !rankingUpload &&
          !publicationsUpload &&
          !((site || centerPassword || rankingEntry || rankingBulk) && req.method === 'PUT')
        )
          return send(405, { detail: 'Método no permitido' });
        if (!adminToken)
          return send(503, { detail: 'Administración deshabilitada (falta CRIS_ADMIN_TOKEN)' });
        const token = req.headers['x-admin-token'];
        if (typeof token !== 'string' || !sameSecret(token, adminToken))
          return send(401, { detail: 'Token de administración inválido' });
        // Fotos de proyectos: además del token, la contraseña del centro (X-Center-Id y
        // X-Center-Password); el proyecto debe ser de ese centro. Solo los directores la tienen.
        const centerId = Number(centerAccess?.[1] ?? req.headers['x-center-id']);
        const centerOk = async () => {
          const center = (await metrikCenters()).find((c) => c.id === centerId && c.active);
          let password = '';
          try {
            password = decodeURIComponent(String(req.headers['x-center-password'] ?? ''));
          } catch {
            /* mal codificada: cuenta como vacía */
          }
          return center && verifyPassword(password, (await centerPasswords.all())[centerId]) ? center : null;
        };
        if (centerAccess) {
          return (await centerOk())
            ? send(200, { ok: true }, true)
            : send(403, { detail: 'Contraseña del centro incorrecta' });
        }
        const projectRoute = projectPhoto ?? staff ?? staffOne;
        if (projectRoute) {
          const center = await centerOk();
          if (!center) return send(403, { detail: 'Contraseña del centro incorrecta' });
          const projectId = Number(projectRoute[1]);
          if (!projectsOfCenter(await metrikProjects(), center.name).some((x) => x.id === projectId))
            return send(403, { detail: 'El proyecto no es de este centro' });
        }
        if (staff || staffOne) {
          const projectId = Number((staff ?? staffOne)![1]);
          try {
            if (staff && req.method === 'GET') return send(200, await fetchStaff(base, projectId), true);
            if (staff) {
              const body = await readBody(req, MAX_JSON_BYTES);
              let person: ReturnType<typeof toStaff> = null;
              try {
                person = body && toStaff(JSON.parse(body.toString('utf8')));
              } catch {
                person = null;
              }
              // Nombre obligatorio; cédula opcional (solo dígitos); rol libre y corto.
              if (
                !person ||
                person.nombreCompleto.length > 200 ||
                (person.rol?.length ?? 0) > 80 ||
                (person.cedula !== null && !/^\d{4,15}$/.test(person.cedula))
              )
                return send(400, {
                  detail: 'Se espera { "nombreCompleto": "…", "rol": "…", "cedula": "123…" (opcional) }',
                });
              await saveStaff(base, projectId, person);
            } else {
              const cedula = decodeURIComponent(staffOne![2]!);
              if (!/^\d{4,15}$/.test(cedula)) return send(400, { detail: 'Cédula inválida' });
              await removeStaff(base, projectId, cedula);
            }
          } catch (err) {
            return send(502, { detail: (err as Error).message }, true);
          }
          metrikProjects.reset(); // la página pública muestra el cambio de inmediato
          return send(200, await fetchStaff(base, projectId), true);
        }
        if (centerPassword) {
          const id = Number(centerPassword[1]);
          if (!(await metrikCenters()).some((c) => c.id === id && c.active))
            return send(404, { detail: 'No encontrado' });
          const body = await readBody(req, MAX_JSON_BYTES);
          let password: unknown;
          try {
            password = body && (JSON.parse(body.toString('utf8')) as { password?: unknown }).password;
          } catch {
            password = undefined;
          }
          if (!(
            password === null ||
            (typeof password === 'string' && password.length >= MIN_CENTER_PASSWORD)
          ))
            return send(400, {
              detail: `Se espera { "password": "…" } (mínimo ${MIN_CENTER_PASSWORD} caracteres) o { "password": null }`,
            });
          try {
            await centerPasswords.set(id, password === null ? null : hashPassword(password));
            return send(200, { hasPassword: password !== null }, true);
          } catch (err) {
            return send(500, { detail: `No se pudo guardar la contraseña: ${(err as Error).message}` });
          }
        }
        if (adminRead) {
          const [ranking, hidden, dir] = await Promise.all([
            rankingStore.all(),
            rankingHidden.all(),
            directory(),
          ]);
          const names = new Map(dir.authors.map((a) => [a.id, a.name]));
          const shown = new Map(publishAuthors(dir, ranking, hidden).map((a) => [a.id, a.ranking]));
          const rows = Object.entries(ranking)
            .map(([id, r]) => ({
              id: Number(id),
              name: names.get(Number(id)) ?? '—',
              ...r,
              hidden: !!hidden[id],
              shown: shown.get(Number(id)) ?? null,
            }))
            .sort((a, b) => a.rank - b.rank);
          return send(200, { rows }, true);
        }
        if (rankingBulk) {
          const body = await readBody(req, MAX_RANKING_BYTES);
          let parsed: { ids?: unknown; visible?: unknown } | null;
          try {
            parsed = body && JSON.parse(body.toString('utf8'));
          } catch {
            parsed = null;
          }
          const ids = parsed?.ids;
          const visible = parsed?.visible;
          if (
            typeof visible !== 'boolean' ||
            !Array.isArray(ids) ||
            ids.length > 10_000 ||
            !ids.every((x) => Number.isInteger(x) && x > 0)
          )
            return send(400, { detail: 'Se espera { "ids": [números], "visible": true | false }' });
          const [ranking, hidden] = await Promise.all([rankingStore.all(), rankingHidden.all()]);
          const next: Record<string, true> = { ...hidden };
          for (const id of ids as number[]) {
            if (!(id in ranking)) continue;
            if (visible) delete next[id];
            else next[id] = true;
          }
          try {
            await rankingHidden.replace(next);
            return send(200, { visible, hidden: Object.keys(next).length }, true);
          } catch (err) {
            return send(500, { detail: `No se pudo guardar: ${(err as Error).message}` });
          }
        }
        if (rankingEntry) {
          const id = Number(rankingEntry[1]);
          if (!(id in (await rankingStore.all()))) return send(404, { detail: 'No está en el ranking' });
          const body = await readBody(req, MAX_JSON_BYTES);
          let visible: unknown;
          try {
            visible = body && (JSON.parse(body.toString('utf8')) as { visible?: unknown }).visible;
          } catch {
            visible = undefined;
          }
          if (typeof visible !== 'boolean')
            return send(400, { detail: 'Se espera { "visible": true | false }' });
          try {
            await rankingHidden.set(id, !visible);
            return send(200, { visible }, true);
          } catch (err) {
            return send(500, { detail: `No se pudo guardar: ${(err as Error).message}` });
          }
        }
        if (publicationsUpload) {
          if (req.method === 'DELETE') {
            await publicationStore.replace({});
            return send(200, { published: 0, invalid: [], unlinked: 0 });
          }
          const body = await readBody(req, MAX_PUBLICATIONS_BYTES);
          if (!body) return send(413, { detail: 'Las publicaciones superan 4 MB' });
          let rows: unknown;
          try {
            rows = (JSON.parse(body.toString('utf8')) as { rows?: unknown }).rows;
          } catch {
            rows = null;
          }
          if (!Array.isArray(rows) || !rows.length || rows.length > 10_000)
            return send(400, { detail: 'Se espera { "rows": [{ rank, eid, title, … }] }' });
          // Por puesto; un EID repetido queda con su mejor puesto.
          const byEid = new Map<string, NonNullable<ReturnType<typeof normalizePublication>>>();
          const invalid: string[] = [];
          for (const raw of rows as Record<string, unknown>[]) {
            const entry = normalizePublication(raw);
            if (!entry) {
              const r = raw as { rank?: unknown; eid?: unknown };
              invalid.push(`#${String(r?.rank ?? '?')} ${String(r?.eid ?? '').slice(0, 30)}`.trim());
            } else if (!byEid.has(entry.eid) || entry.rank < byEid.get(entry.eid)!.rank)
              byEid.set(entry.eid, entry);
          }
          const { byEid: authorsOf } = await directory();
          try {
            const saved = await publicationStore.replace(
              Object.fromEntries([...byEid.values()].map((e) => [e.rank, e])),
            );
            const all = Object.values(saved);
            return send(200, {
              published: all.length,
              invalid,
              unlinked: all.filter((e) => !authorsOf.get(e.eid)?.length).length,
            });
          } catch (err) {
            return send(500, {
              detail: `No se pudieron guardar las publicaciones: ${(err as Error).message}`,
            });
          }
        }
        if (rankingUpload) {
          // DELETE: sin ranking general, se vuelve a publicar a los seleccionados de Metri-K; sin el de
          // un apartado, ese Top queda vacío.
          const target = rankingTier ? rankingTiers[rankingTier] : rankingStore;
          if (req.method === 'DELETE') {
            await target.replace({});
            return send(200, { published: 0, notFound: [], inactive: [], invalid: [] });
          }
          const body = await readBody(req, MAX_RANKING_BYTES);
          if (!body) return send(413, { detail: 'El ranking supera 1 MB' });
          let rows: unknown;
          try {
            rows = (JSON.parse(body.toString('utf8')) as { rows?: unknown }).rows;
          } catch {
            rows = null;
          }
          if (!Array.isArray(rows) || !rows.length || rows.length > 10_000)
            return send(400, {
              detail: 'Se espera { "rows": [{ cc, name, rank, centerRank, center, index }] }',
            });
          // La cédula solo sirve para encontrar al investigador en Metri-K: se guarda por id.
          const { byDocument, authors } = await directory();
          const active = new Set(authors.map((a) => a.id));
          const byId: Record<string, unknown> = {};
          const labels = new Map<number, string>();
          const notFound: string[] = [];
          const inactive: string[] = [];
          const invalid: string[] = [];
          for (const raw of rows as Record<string, unknown>[]) {
            const label =
              typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 120) : '—';
            const entry = normalizeRanking(raw);
            const id = byDocument.get(normalizeDocument(raw?.cc));
            if (!entry) invalid.push(label);
            else if (id === undefined) notFound.push(label);
            else if (!active.has(id)) inactive.push(label);
            // Repetido: queda el mejor puesto.
            else if (!byId[id] || entry.rank < (byId[id] as { rank: number }).rank) {
              byId[id] = entry;
              labels.set(id, label);
            }
          }
          try {
            const saved = await target.replace(byId);
            return send(200, {
              published: Object.keys(saved).length,
              notFound,
              inactive,
              invalid,
            });
          } catch (err) {
            return send(500, { detail: `No se pudo guardar el ranking: ${(err as Error).message}` });
          }
        }
        if (site) {
          const id = Number(site[1]);
          if (!(await metrikCenters()).some((c) => c.id === id && c.active))
            return send(404, { detail: 'No encontrado' });
          const body = await readBody(req, MAX_JSON_BYTES);
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
            centerId: Number(sp.get('center')) || undefined,
            tier: isRankingTier(sp.get('tier')) ? (sp.get('tier') as RankingTier) : undefined,
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
              // Cada grupo lleva sus ODS (Metri-K): el perfil muestra los que el investigador hereda.
              groups: await (async () => {
                const byId = new Map((await metrikGroups()).map((x) => [x.id, x]));
                return (await groupsOf(a.id)).map((g) => ({
                  ...g,
                  ods: byId.get(g.id)?.ods ?? [],
                  type: byId.get(g.id)?.type ?? null,
                }));
              })(),
              production: production.get(a.id) ?? null,
            })
          : send(404, { detail: 'No encontrado' });
      }

      if (p === '/api/publications') {
        const quartile = sp.get('quartile');
        const sort = sp.get('sort');
        const page = Number(sp.get('page')) || 1;
        const size = Number(sp.get('size')) || 20;
        return send(
          200,
          queryPublications(await publications(), {
            search: sp.get('q') ?? undefined,
            yearFrom: Number(sp.get('from')) || undefined,
            yearTo: Number(sp.get('to')) || undefined,
            quartile: QUARTILES.includes(quartile as Quartile) ? (quartile as Quartile) : undefined,
            type: sp.get('type') || undefined,
            area: sp.get('area') || undefined,
            openAccess: sp.get('oa') === '1' || undefined,
            sort: PUBLICATION_SORTS.includes(sort as PublicationSort) ? (sort as PublicationSort) : undefined,
            page: Math.max(1, Math.floor(page)),
            pageSize: Math.min(Math.max(1, Math.floor(size)), MAX_PAGE_SIZE),
          }),
        );
      }
      if (p === '/api/publications/stats')
        return send(200, publicationStats(Object.values(await publicationStore.all())));

      if (p === '/api/groups') return send(200, (await groups()).map(summarizeGroup));
      const members = /^\/api\/groups\/(\d{1,12})\/members$/.exec(p);
      if (members) {
        const id = Number(members[1]);
        if (!(await groups()).some((g) => g.id === id && g.active && hasPublicDetail(g)))
          return send(404, { detail: 'No encontrado' });
        return send(200, await membersOf(id));
      }
      const grp = /^\/api\/groups\/(\d{1,12})$/.exec(p);
      if (grp) {
        // Interinstitucionales: solo en el listado, sin ficha.
        const g = (await groups()).find((x) => x.id === Number(grp[1]) && hasPublicDetail(x));
        return g ? send(200, g) : send(404, { detail: 'No encontrado' });
      }

      const countryPubsRoute = /^\/api\/relations\/countries\/([A-Z]{3})\/publications$/.exec(p);
      if (p === '/api/relations/countries' || countryPubsRoute) {
        const raw = sp.get('year');
        const year = raw ? Number(raw) : null;
        if (
          year !== null &&
          !(Number.isInteger(year) && year >= FIRST_RELATIONS_YEAR && year <= new Date().getFullYear())
        )
          return send(400, { detail: 'Año inválido' });
        if (!countryPubsRoute) return send(200, await collaboration(year));
        const pubs = await publicationsWith(countryPubsRoute[1]!, year);
        return pubs ? send(200, pubs) : send(404, { detail: 'País sin publicaciones' });
      }
      // ponytail: el listado va completo (~10 proyectos, pocos KB); resumirlo si pasan de cientos.
      if (p === '/api/projects') return send(200, await projects());
      const prj = /^\/api\/projects\/(\d{1,12})$/.exec(p);
      if (prj) {
        const x = (await projects()).find((y) => y.id === Number(prj[1]));
        return x ? send(200, x) : send(404, { detail: 'No encontrado' });
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
