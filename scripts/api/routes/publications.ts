// Ranking de publicaciones Scopus: consulta pública filtrable y carga del Excel (admin).
import {
  PUBLICATION_SORTS,
  publicationStats,
  queryPublications,
  type PublicationSort,
} from '../../../src/domain/publications/publication.ts';
import { normalizePublication } from '../../ods-store.ts';
import { MAX_PUBLICATIONS_BYTES, pageParams, readBody, readField, saveOr500 } from '../http.ts';
import type { Route } from '../router.ts';

const MAX_ROWS = 10_000;

type Normalized = NonNullable<ReturnType<typeof normalizePublication>>;

/**
 * Filas del Excel → publicaciones por EID (un EID repetido queda con su mejor puesto) y las filas inválidas
 * («#puesto eid»).
 */
export function dedupePublicationRows(rows: Record<string, unknown>[]) {
  const byEid = new Map<string, Normalized>();
  const invalid: string[] = [];
  for (const raw of rows) {
    const entry = normalizePublication(raw);
    if (!entry) {
      const r = raw as { rank?: unknown; eid?: unknown };
      invalid.push(`#${String(r?.rank ?? '?')} ${String(r?.eid ?? '').slice(0, 30)}`.trim());
    } else if (!byEid.has(entry.eid) || entry.rank < byEid.get(entry.eid)!.rank) byEid.set(entry.eid, entry);
  }
  return { byEid, invalid };
}

const listPublications: Route = {
  match: /^\/api\/publications$/,
  async handler({ ctx, sp, send }) {
    const sort = sp.get('sort');
    return send(
      200,
      queryPublications(await ctx.publications(), {
        search: sp.get('q') ?? undefined,
        yearFrom: Number(sp.get('from')) || undefined,
        yearTo: Number(sp.get('to')) || undefined,
        type: sp.get('type') || undefined,
        area: sp.get('area') || undefined,
        openAccess: sp.get('oa') === '1' || undefined,
        sort: PUBLICATION_SORTS.includes(sort as PublicationSort) ? (sort as PublicationSort) : undefined,
        ...pageParams(sp, 20),
      }),
    );
  },
};

const publicationsStats: Route = {
  match: /^\/api\/publications\/stats$/,
  async handler({ ctx, send }) {
    return send(200, publicationStats(Object.values(await ctx.publicationStore.all())));
  },
};

const publicationsUpload: Route = {
  match: /^\/api\/publications$/,
  methods: ['PUT', 'PATCH', 'DELETE'],
  async handler({ ctx, req, send }) {
    if (req.method === 'DELETE') {
      await ctx.publicationStore.replace({});
      return send(200, { published: 0, invalid: [], unlinked: 0 });
    }
    const body = await readBody(req, MAX_PUBLICATIONS_BYTES);
    if (!body) return send(413, { detail: 'Las publicaciones superan 16 MB' });
    const rows = readField(body, (j) => j.rows, null);
    if (!Array.isArray(rows) || !rows.length || rows.length > MAX_ROWS)
      return send(400, { detail: 'Se espera { "rows": [{ rank, eid, title, … }] }' });
    // Por puesto; un EID repetido queda con su mejor puesto.
    const { byEid, invalid } = dedupePublicationRows(rows as Record<string, unknown>[]);
    const { byEid: authorsOf } = await ctx.directory();
    const saved = await saveOr500(send, 'No se pudieron guardar las publicaciones', () =>
      ctx.publicationStore.replace(Object.fromEntries([...byEid.values()].map((e) => [e.rank, e]))),
    );
    if (!saved) return;
    const all = Object.values(saved.value);
    send(200, {
      published: all.length,
      invalid,
      unlinked: all.filter((e) => !authorsOf.get(e.eid)?.length).length,
    });
  },
};

export const publicationPublicRoutes = [listPublications, publicationsStats];
export const publicationAdminRoutes = [publicationsUpload];
