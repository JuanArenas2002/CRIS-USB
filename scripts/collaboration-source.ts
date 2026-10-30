// Fuente de relacionamiento: API de colaboración (afiliaciones Scopus de la institución).
//   GET {base}/api/collaboration/institution/affiliations/publications?include_publications=false
// Sin publicaciones la respuesta pesa ~40 KB (con ellas, ~6,6 MB): el mapa solo necesita conteos.
import type {
  CollaborationMap,
  CountryCollaboration,
  CountryPublication,
} from '../src/domain/relations/relations.ts';
import { obj, str } from './groups-source.ts';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function toCountry(raw: unknown): CountryCollaboration | null {
  const r = obj(raw);
  const iso2 = str(r?.iso2)?.toUpperCase();
  const iso3 = str(r?.iso3);
  const isoNumeric = str(r?.iso_numeric)?.padStart(3, '0');
  const country = str(r?.country);
  if (!iso2 || !/^[A-Z]{2}$/.test(iso2) || !iso3 || !isoNumeric || !/^\d{3}$/.test(isoNumeric) || !country)
    return null;
  return {
    iso2,
    iso3,
    isoNumeric,
    country,
    local: r?.collaboration_type === 'nacional',
    publications: num(r?.total_publications),
    citations: num(r?.total_citations),
  };
}

const yearQuery = (year: number | null) => {
  const q = new URLSearchParams();
  if (year) {
    q.set('year_from', String(year));
    q.set('year_to', String(year));
  }
  return q;
};

async function getJson(url: string) {
  const r = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`API de colaboración ${url}: HTTP ${r.status}`);
  return obj(await r.json());
}

/** "CONFERENCE PAPER" → "Conference paper" (como lo nombra Scopus en el resto del portal). */
const docType = (v: unknown) => {
  const s = str(v)?.toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
};

/** Publicación pública: sin el detalle de autores (ORCID, país de cada uno) que la tarjeta no usa. */
export function toCountryPublication(raw: unknown): CountryPublication | null {
  const r = obj(raw);
  const eid = str(r?.eid);
  const title = str(r?.title);
  if (!eid || !title) return null;
  return {
    eid,
    title,
    year: Number.isInteger(r?.year) ? (r!.year as number) : null,
    doi: str(r?.doi),
    journal: str(r?.journal),
    docType: docType(r?.doc_type),
    citations: num(r?.citations),
    quartile: str(r?.quartile)?.toUpperCase() ?? null,
    partners: Array.isArray(r?.partner_institutions)
      ? r!.partner_institutions.flatMap((x) => str(x) ?? [])
      : [],
  };
}

/** Publicaciones con un país, por su nombre en Scopus ("Spain"). Más recientes primero. */
export async function fetchCountryPublications(
  base: string,
  country: string,
  year: number | null,
): Promise<CountryPublication[]> {
  const q = yearQuery(year);
  const url = `${base}/api/collaboration/institution/affiliations/${encodeURIComponent(country)}/publications${q.size ? `?${q}` : ''}`;
  const pubs = (await getJson(url))?.publications;
  return (Array.isArray(pubs) ? pubs : [])
    .flatMap((p) => toCountryPublication(p) ?? [])
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.citations - a.citations);
}

/** Conteos por país (con código ISO) de un año, o de todos si `year` es null. `base` sin `/api`. */
export async function fetchCollaborationMap(base: string, year: number | null): Promise<CollaborationMap> {
  const q = yearQuery(year);
  q.set('include_publications', 'false');
  const url = `${base}/api/collaboration/institution/affiliations/publications?${q}`;
  const byIso = obj((await getJson(url))?.by_iso3);
  if (!byIso) throw new Error(`API de colaboración ${url}: formato inesperado (falta \`by_iso3\`)`);
  const countries = Object.values(byIso)
    .flatMap((c) => toCountry(c) ?? [])
    .sort((a, b) => b.publications - a.publications);
  return { year, countries };
}
