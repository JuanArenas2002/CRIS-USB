// Fuente de investigadores (Metri-K). SOLO servidor: `GET /api/investigator` trae cédula, correo,
// teléfono, género y etnia de cada persona; `GET /api/group/investigator/{id}` trae además hashes
// de contraseña. Aquí se proyecta a una lista blanca de campos públicos.
// `GET /api/investigator/seleccionados` (destacados) no trae datos personales: índice H y producción.
import type {
  Author,
  AuthorMetrics,
  AuthorProduction,
  AuthorProfile,
  AuthorRanking,
  GroupRef,
  RankingTier,
  ScopusPublication,
  TechDevelopment,
  Thesis,
} from '../src/domain/authors/author.ts';
import { parseCategory } from '../src/domain/authors/author.ts';
import { fetchInvestigatorCenters } from './centers-source.ts';
import {
  cleanText,
  fullName,
  getData,
  httpsUrl,
  mapLimit,
  obj,
  str,
  toPublicGroup,
  type Raw,
} from './groups-source.ts';

const MINCIENCIAS = /(^|\.)minciencias\.gov\.co$/;
const SCHOLAR = /(^|\.)scholar\.google\.[a-z.]+$/;
const SCOPUS = /(^|\.)scopus\.com$/;
/**
 * Sin ranking cargado (/admin/ranking), el portal publica solo los investigadores seleccionados en
 * Metri-K. Para publicar a todos los activos en GrupLAC, poner en false (ver publishAuthors).
 */
export const ONLY_SELECTED = true;

const HANDLE = /(^|\.)(handle\.net|unisimon\.edu\.co)$/;

const year = (v: unknown): number | null => {
  const y = Number(typeof v === 'string' ? v.slice(0, 4) : v);
  return Number.isInteger(y) && y > 1900 ? y : null;
};
const count = (v: unknown) => (typeof v === 'number' && v >= 0 ? Math.floor(v) : 0);
const list = <T>(v: unknown, fn: (r: Raw) => T | null): T[] =>
  Array.isArray(v)
    ? v.flatMap((r) => {
        const p = obj(r) && fn(r as Raw);
        return p ? [p] : [];
      })
    : [];

/**
 * Política de publicación: solo investigadores activos en GrupLAC (`state_gruplac`).
 * De `person` solo se lee el nombre y el nivel de formación; el resto nunca sale.
 */
export function toPublicInvestigator(raw: Raw): Author | null {
  const name = fullName(raw);
  if (typeof raw.id !== 'number' || !name || raw.state_gruplac !== true) return null;
  const group = obj(raw.groupMain);
  return {
    id: raw.id,
    name,
    category: parseCategory(str(raw.lastCategory)),
    degree: str(obj(raw.person)?.level_education),
    orcid: str(raw.orcid)?.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/)?.[0] ?? null,
    scopusId: str(raw.id_scopus)?.match(/^\d{6,15}$/)?.[0] ?? null,
    cvlacUrl: httpsUrl(raw.cvlac, MINCIENCIAS),
    scholarUrl: httpsUrl(raw.google_scholar, SCHOLAR),
    mainGroup:
      group && typeof group.id === 'number' && str(group.name) && str(group.code)
        ? { id: group.id, name: str(group.name)!, code: str(group.code)! }
        : null,
    metrics: null,
    photoUrl: null,
  };
}

/** Un elemento de `/investigator/seleccionados` → métricas + producción (ordenada, más reciente primero). */
export function toSelected(raw: Raw): {
  id: number;
  metrics: AuthorMetrics;
  production: AuthorProduction;
  scopusId: string | null;
} | null {
  if (typeof raw.id !== 'number') return null;
  const prod = obj(raw.produccion);
  const totals = obj(prod?.totales);
  // Un investigador puede tener varios perfiles de Scopus; se muestra el de mayor índice H.
  const best = list(raw.authorsIds, (a) => {
    const h = Number.parseInt(str(a.indice_h) ?? '', 10);
    const id = str(a.authorId)?.match(/^\d{6,15}$/)?.[0];
    return Number.isFinite(h) && id ? { h, id } : null;
  }).sort((a, b) => b.h - a.h)[0];

  const publications = list<ScopusPublication>(prod?.publicacionesScopus, (p) => {
    const title = cleanText(p.title);
    return typeof p.id === 'number' && title
      ? {
          id: p.id,
          title,
          year: year(p.year),
          journal: cleanText(p.sourceTitle),
          type: str(p.documentType),
          citedBy: count(p.citedBy),
          doi: str(p.doi)?.match(/^10\.\d{4,9}\/\S+$/)?.[0] ?? null,
          url: httpsUrl(p.link, SCOPUS),
          authors: cleanText(p.authors),
        }
      : null;
  }).sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.citedBy - a.citedBy);

  const theses = list<Thesis>(prod?.trabajosDeFormacion, (t) => {
    const title = cleanText(t.titulo);
    return typeof t.id === 'number' && title
      ? {
          id: t.id,
          title,
          year: year(t.year),
          level: str(t.tipo),
          program: cleanText(t.programa),
          url: httpsUrl(t.enlace_bonga, HANDLE),
          authors: cleanText(t.autores),
        }
      : null;
  }).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  const developments = list<TechDevelopment>(prod?.desarrollosTecnologicos, (d) => {
    const title = cleanText(d.title);
    return typeof d.id === 'number' && title
      ? { id: d.id, title, year: year(d.year), kind: cleanText(d.subtype), company: cleanText(d.company) }
      : null;
  }).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  return {
    id: raw.id,
    metrics: {
      hIndex: best?.h ?? null,
      scopusPublications: count(totals?.publicacionesScopus) || publications.length,
      products: count(totals?.total),
    },
    production: { publications, theses, developments },
    scopusId: best?.id ?? null,
  };
}

/** Cédula normalizada (solo dígitos). */
export const normalizeDocument = (v: unknown) =>
  typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\D/g, '') : '';

export interface InvestigatorDirectory {
  /** Todos los activos en GrupLAC, ya proyectados (métricas solo para los seleccionados). */
  authors: Author[];
  /** Seleccionados en Metri-K (destacados). */
  selected: Set<number>;
  production: Map<number, AuthorProduction>;
  /**
   * Cédula → id del investigador, para cruzar el ranking USB. SOLO servidor: nunca se envía al
   * navegador ni se guarda (el ranking se guarda por id).
   */
  byDocument: Map<string, number>;
  /** EID de Scopus → seleccionados que lo firman (autores del ranking de publicaciones). */
  byEid: Map<string, number[]>;
}

/**
 * Directorio de Metri-K + métricas de los destacados. `base` es `.../api` de Metri-K.
 * Quién se publica lo decide publishAuthors.
 */
export async function fetchInvestigators(base: string): Promise<InvestigatorDirectory> {
  const [rows, selected] = await Promise.all([
    getData(`${base}/investigator`),
    getData(`${base}/investigator/seleccionados`),
  ]);
  const extra = new Map(list(selected, toSelected).map((s) => [s.id, s]));
  const byEid = new Map<string, number[]>();
  for (const r of selected.map(obj)) {
    if (typeof r?.id !== 'number') continue;
    for (const eid of list(obj(r.produccion)?.publicacionesScopus, (p) => str(p.eid)))
      byEid.set(eid, [...new Set([...(byEid.get(eid) ?? []), r.id])]);
  }
  const authors = list(rows, toPublicInvestigator).map((a) => {
    const s = extra.get(a.id);
    return {
      ...a,
      metrics: s?.metrics ?? null,
      scopusId: s?.scopusId ?? a.scopusId,
    };
  });
  const byDocument = new Map<string, number>();
  for (const r of rows.map(obj)) {
    const person = obj(r?.person);
    if (typeof r?.id !== 'number') continue;
    for (const doc of [person?.documentNumber, person?.documentNumber2].map(normalizeDocument))
      if (doc) byDocument.set(doc, r.id);
  }
  return {
    authors,
    selected: new Set(extra.keys()),
    production: new Map([...extra].map(([id, s]) => [id, s.production])),
    byDocument,
    byEid,
  };
}

/**
 * Puestos visibles: se renumeran solo entre los publicados (1, 2, 3… sin huecos), en general y
 * dentro de cada centro. Si se oculta al 4.º, el 5.º pasa a mostrarse como 4.º.
 */
export function renumber<T extends { ranking: AuthorRanking }>(items: T[]): T[] {
  const byRank = [...items].sort((a, b) => a.ranking.rank - b.ranking.rank);
  const general = new Map(byRank.map((a, i) => [a, i + 1]));
  const inCenter = new Map<T, number>();
  const centers = new Map<string, T[]>();
  for (const a of byRank)
    if (a.ranking.center) centers.set(a.ranking.center, [...(centers.get(a.ranking.center) ?? []), a]);
  for (const list of centers.values())
    list
      .sort(
        (a, b) =>
          (a.ranking.centerRank ?? Infinity) - (b.ranking.centerRank ?? Infinity) ||
          a.ranking.rank - b.ranking.rank,
      )
      .forEach((a, i) => inCenter.set(a, i + 1));
  return items.map((a) => ({
    ...a,
    ranking: { ...a.ranking, rank: general.get(a)!, centerRank: inCenter.get(a) ?? null },
  }));
}

/**
 * Política de publicación: con ranking USB cargado, se publican los que figuran en él, siguen
 * activos en GrupLAC y no están ocultos en /admin/ranking, con los puestos renumerados entre ellos;
 * sin ranking, los seleccionados en Metri-K.
 */
export function publishAuthors(
  { authors, selected }: Pick<InvestigatorDirectory, 'authors' | 'selected'>,
  ranking: Record<string, AuthorRanking>,
  hidden: Record<string, true> = {},
): Author[] {
  if (!Object.keys(ranking).length)
    return authors.filter((a) => !ONLY_SELECTED || selected.has(a.id)).map((a) => ({ ...a, ranking: null }));
  return renumber(
    authors.filter((a) => a.id in ranking && !hidden[a.id]).map((a) => ({ ...a, ranking: ranking[a.id]! })),
  );
}

/**
 * Publicados del general (publishAuthors) más los de cada Top: activos en GrupLAC con fila en su
 * Excel, aunque estén ocultos o fuera del general (esos van con `tierOnly`). Los puestos de cada Top
 * se renumeran entre sus activos.
 */
export function publishWithTiers(
  dir: Pick<InvestigatorDirectory, 'authors' | 'selected'>,
  ranking: Record<string, AuthorRanking>,
  hidden: Record<string, true>,
  tierRows: Record<RankingTier, Record<string, AuthorRanking>>,
): Author[] {
  const general = publishAuthors(dir, ranking, hidden);
  const byTier = Object.fromEntries(
    (Object.keys(tierRows) as RankingTier[]).map((t) => [
      t,
      new Map(
        renumber(
          dir.authors
            .filter((a) => a.id in tierRows[t])
            .map((a) => ({ id: a.id, ranking: tierRows[t][a.id]! })),
        ).map((a) => [a.id, a.ranking]),
      ),
    ]),
  ) as Record<RankingTier, Map<number, AuthorRanking>>;
  const tiersOf = (id: number) =>
    Object.fromEntries(
      (Object.keys(byTier) as RankingTier[]).flatMap((t) => {
        const r = byTier[t].get(id);
        return r ? [[t, r]] : [];
      }),
    );
  const inGeneral = new Set(general.map((a) => a.id));
  const extra = dir.authors
    .filter((a) => !inGeneral.has(a.id) && Object.values(byTier).some((m) => m.has(a.id)))
    .map((a) => ({ ...a, ranking: null, tierOnly: true }));
  return [...general, ...extra].map((a) => ({ ...a, tiers: tiersOf(a.id) }));
}

export async function fetchInvestigatorGroups(base: string, id: number): Promise<GroupRef[]> {
  return list(await getData(`${base}/group/investigator/${id}`), (r) => {
    const g = toPublicGroup(r);
    return g && g.active ? { id: g.id, code: g.code, name: g.name, category: g.category } : null;
  });
}

/** Perfiles completos para el prerender (grupos y centros de cada investigador, 6 a la vez). */
export async function withProfiles(
  base: string,
  { authors, production }: { authors: Author[]; production: InvestigatorDirectory['production'] },
): Promise<AuthorProfile[]> {
  return mapLimit(authors, 6, async (a) => ({
    ...a,
    groups: await fetchInvestigatorGroups(base, a.id),
    centers: await fetchInvestigatorCenters(base, a.id),
    production: production.get(a.id) ?? null,
  }));
}

/** Integrantes activos en GrupLAC de un grupo (`/investigator/group/{id}`, con datos personales → proyección). */
export async function fetchGroupMembers(base: string, groupId: number): Promise<Author[]> {
  return list(await getData(`${base}/investigator/group/${groupId}`), toPublicInvestigator);
}
