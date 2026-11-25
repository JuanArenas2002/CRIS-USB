// Ranking Unisimón de investigadores (admin): lista, carga de Excel (general o Top 12 / Top 60) y visibilidad.
import type { RankingTier } from '../../../src/domain/authors/author.ts';
import { normalizeDocument, publishAuthors } from '../../investigators-source.ts';
import { normalizeRanking } from '../../ods-store.ts';
import { MAX_JSON_BYTES, MAX_RANKING_BYTES, readBody, readField, saveOr500 } from '../http.ts';
import type { Route } from '../router.ts';

const MAX_ROWS = 10_000;

type Directory = {
  byDocument: ReadonlyMap<string, number>;
  authors: readonly { id: number }[];
};

/**
 * Filas del Excel → ranking por id. La cédula solo sirve para encontrar al investigador en Metri-K: se guarda por
 * id. Cada fila va a una sola lista (sin puesto, sin cédula en Metri-K, inactivo) o se queda; si se repite
 * un investigador, queda el mejor puesto.
 */
export function classifyRankingRows(rows: Record<string, unknown>[], { byDocument, authors }: Directory) {
  const active = new Set(authors.map((a) => a.id));
  const byId: Record<string, unknown> = {};
  const notFound: string[] = [];
  const inactive: string[] = [];
  const invalid: string[] = [];
  for (const raw of rows) {
    const label = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 120) : '—';
    const entry = normalizeRanking(raw);
    const id = byDocument.get(normalizeDocument(raw?.cc));
    if (!entry) invalid.push(label);
    else if (id === undefined) notFound.push(label);
    else if (!active.has(id)) inactive.push(label);
    else if (!byId[id] || entry.rank < (byId[id] as { rank: number }).rank) byId[id] = entry;
  }
  return { byId, notFound, inactive, invalid };
}

const validRows = (rows: unknown): rows is Record<string, unknown>[] =>
  Array.isArray(rows) && rows.length > 0 && rows.length <= MAX_ROWS;

// Lista del ranking para el admin: nombres y puestos de todos (incluidos los ocultos).
const rankingList: Route = {
  match: /^\/api\/ranking$/,
  methods: ['GET'],
  async handler({ ctx, send }) {
    const [ranking, hidden, dir] = await Promise.all([
      ctx.rankingStore.all(),
      ctx.rankingHidden.all(),
      ctx.directory(),
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
  },
};

// Ranking general (/api/ranking) o el de un apartado (/api/ranking/top12, /api/ranking/top60).
const rankingUpload: Route = {
  match: /^\/api\/ranking(?:\/(top12|top60))?$/,
  methods: ['PUT', 'PATCH', 'DELETE'],
  async handler({ ctx, req, send }, m) {
    const tier = m[1] as RankingTier | undefined;
    // DELETE: sin ranking general, se vuelve a publicar a los seleccionados de Metri-K; sin el de un apartado,
    // ese Top queda vacío.
    const target = tier ? ctx.rankingTiers[tier] : ctx.rankingStore;
    if (req.method === 'DELETE') {
      await target.replace({});
      return send(200, { published: 0, notFound: [], inactive: [], invalid: [] });
    }
    const body = await readBody(req, MAX_RANKING_BYTES);
    if (!body) return send(413, { detail: 'El ranking supera 1 MB' });
    const rows = readField(body, (j) => j.rows, null);
    if (!validRows(rows))
      return send(400, { detail: 'Se espera { "rows": [{ cc, name, rank, centerRank, center, index }] }' });
    const { byId, notFound, inactive, invalid } = classifyRankingRows(rows, await ctx.directory());
    const saved = await saveOr500(send, 'No se pudo guardar el ranking', () => target.replace(byId));
    if (saved) send(200, { published: Object.keys(saved.value).length, notFound, inactive, invalid });
  },
};

// Varios a la vez («Activar / Desactivar todos» en el admin): una sola escritura.
const rankingVisibilityBulk: Route = {
  match: /^\/api\/ranking\/visibility$/,
  methods: ['PUT'],
  async handler({ ctx, req, send }) {
    const parsed = readField(await readBody(req, MAX_RANKING_BYTES), (j) => j, null) as {
      ids?: unknown;
      visible?: unknown;
    } | null;
    const ids = parsed?.ids;
    const visible = parsed?.visible;
    if (
      typeof visible !== 'boolean' ||
      !Array.isArray(ids) ||
      ids.length > MAX_ROWS ||
      !ids.every((x) => Number.isInteger(x) && x > 0)
    )
      return send(400, { detail: 'Se espera { "ids": [números], "visible": true | false }' });
    const [ranking, hidden] = await Promise.all([ctx.rankingStore.all(), ctx.rankingHidden.all()]);
    const next: Record<string, true> = { ...hidden };
    for (const id of ids as number[]) {
      if (!(id in ranking)) continue;
      if (visible) delete next[id];
      else next[id] = true;
    }
    const saved = await saveOr500(send, 'No se pudo guardar', () => ctx.rankingHidden.replace(next));
    if (saved) send(200, { visible, hidden: Object.keys(next).length }, true);
  },
};

const rankingEntryVisibility: Route = {
  match: /^\/api\/ranking\/(\d{1,12})$/,
  methods: ['PUT'],
  async handler({ ctx, req, send }, m) {
    const id = Number(m[1]);
    if (!(id in (await ctx.rankingStore.all()))) return send(404, { detail: 'No está en el ranking' });
    const visible = readField(await readBody(req, MAX_JSON_BYTES), (j) => j.visible, undefined);
    if (typeof visible !== 'boolean') return send(400, { detail: 'Se espera { "visible": true | false }' });
    const saved = await saveOr500(send, 'No se pudo guardar', () => ctx.rankingHidden.set(id, !visible));
    if (saved) send(200, { visible }, true);
  },
};

export const rankingAdminRoutes = [rankingList, rankingVisibilityBulk, rankingEntryVisibility, rankingUpload];
