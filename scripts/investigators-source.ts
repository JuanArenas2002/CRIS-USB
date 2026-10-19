// Fuente de investigadores (Metri-K). SOLO servidor: `GET /api/investigator` trae cédula, correo,
// teléfono, género y etnia de cada persona; `GET /api/group/investigator/{id}` trae además hashes
// de contraseña. Aquí se proyecta a una lista blanca de campos públicos.
// `GET /api/investigator/seleccionados` (destacados) no trae datos personales: índice H y producción.
import type {
  Author,
  AuthorMetrics,
  AuthorProduction,
  AuthorProfile,
  GroupRef,
  ScopusPublication,
  TechDevelopment,
  Thesis,
} from '../src/domain/authors/author.ts';
import { parseCategory } from '../src/domain/authors/author.ts';
import {
  cleanText,
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
 * ponytail: por ahora el portal publica solo los investigadores seleccionados en Metri-K.
 * Para publicar a todos los activos en GrupLAC, poner en false (el resto del sistema ya lo soporta).
 */
export const ONLY_SELECTED = true;

const HANDLE = /(^|\.)(handle\.net|unisimon\.edu\.co)$/;

/** "RODRIGUEZ LARA, INES EMILIA" → "INES EMILIA RODRIGUEZ LARA" (el front le da formato). */
function fullName(raw: Raw): string | null {
  const std = str(raw.name_standard);
  if (std) {
    const [last, first] = std.split(',').map((s) => s.trim());
    return first ? `${first} ${last}` : (last ?? null);
  }
  const person = obj(raw.person);
  return [str(person?.name), str(person?.lastname)].filter(Boolean).join(' ') || null;
}

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
export function toSelected(
  raw: Raw,
): { id: number; metrics: AuthorMetrics; production: AuthorProduction } | null {
  if (typeof raw.id !== 'number') return null;
  const prod = obj(raw.produccion);
  const totals = obj(prod?.totales);
  // Un investigador puede tener varios perfiles de Scopus; se toma el mayor índice H.
  const hs = list(raw.authorsIds, (a) => {
    const h = Number.parseInt(str(a.indice_h) ?? '', 10);
    return Number.isFinite(h) ? { h } : null;
  }).map((x) => x.h);

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
      hIndex: hs.length ? Math.max(...hs) : null,
      scopusPublications: count(totals?.publicacionesScopus) || publications.length,
      products: count(totals?.total),
    },
    production: { publications, theses, developments },
  };
}

/**
 * Lista pública + métricas de los destacados. `base` es `.../api` de Metri-K.
 * Devuelve también la producción de los destacados, para su perfil.
 */
export async function fetchInvestigators(
  base: string,
): Promise<{ authors: Author[]; production: Map<number, AuthorProduction> }> {
  const [rows, selected] = await Promise.all([
    getData(`${base}/investigator`),
    getData(`${base}/investigator/seleccionados`),
  ]);
  const extra = new Map(list(selected, toSelected).map((s) => [s.id, s]));
  const authors = list(rows, toPublicInvestigator)
    .filter((a) => !ONLY_SELECTED || extra.has(a.id))
    .map((a) => ({
      ...a,
      metrics: extra.get(a.id)?.metrics ?? null,
    }));
  return { authors, production: new Map([...extra].map(([id, s]) => [id, s.production])) };
}

export async function fetchInvestigatorGroups(base: string, id: number): Promise<GroupRef[]> {
  return list(await getData(`${base}/group/investigator/${id}`), (r) => {
    const g = toPublicGroup(r);
    return g && g.active ? { id: g.id, code: g.code, name: g.name, category: g.category } : null;
  });
}

/** Perfiles completos para el prerender (una petición de grupos por investigador, 6 a la vez). */
export async function withProfiles(
  base: string,
  { authors, production }: Awaited<ReturnType<typeof fetchInvestigators>>,
): Promise<AuthorProfile[]> {
  return mapLimit(authors, 6, async (a) => ({
    ...a,
    groups: await fetchInvestigatorGroups(base, a.id),
    production: production.get(a.id) ?? null,
  }));
}

/** Integrantes activos en GrupLAC de un grupo (`/investigator/group/{id}`, con datos personales → proyección). */
export async function fetchGroupMembers(base: string, groupId: number): Promise<Author[]> {
  return list(await getData(`${base}/investigator/group/${groupId}`), toPublicInvestigator);
}
