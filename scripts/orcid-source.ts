// Fuente ORCID (API pública oficial v3.0). SOLO servidor.
//   GET {base}/{orcid}/record   → registro público completo (persona + resumen de actividades)
// Solo se lee información PÚBLICA (la API pública no entrega la privada ni la de "confianza").
// Se proyecta a una lista blanca (perfil, empleos, educación): nada más sale de este módulo.
// Límites de la API pública (anónima): ~24 peticiones/s; el BFF cachea cada perfil 10 min.
import type {
  AffiliationKind,
  OrcidAffiliation,
  OrcidProfile,
  OrcidSearchHit,
  PartialDate,
} from '../src/domain/orcid/orcid.ts';
import { obj, str, type Raw } from './groups-source.ts';

export const DEFAULT_ORCID_URL = 'https://pub.orcid.org/v3.0';

const value = (v: unknown) => str(obj(v)?.value);
/** Las fechas del historial vienen en milisegundos desde 1970. */
const isoFromMillis = (v: unknown) => {
  const ms = obj(v)?.value;
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/** {year, month, day} de ORCID → "2020", "2020-03" o "2020-03-15". */
export function partialDate(v: unknown): PartialDate | null {
  const d = obj(v);
  const year = value(d?.year);
  if (!year || !/^\d{4}$/.test(year)) return null;
  const month = value(d?.month);
  const day = value(d?.day);
  return [
    year,
    month && /^\d{2}$/.test(month) ? month : null,
    month && day && /^\d{2}$/.test(day) ? day : null,
  ]
    .filter(Boolean)
    .join('-');
}

function toAffiliation(summary: Raw, kind: AffiliationKind): OrcidAffiliation | null {
  const org = obj(summary.organization);
  const organization = str(org?.name);
  if (!organization) return null;
  const address = obj(org?.address);
  const disamb = obj(org?.['disambiguated-organization']);
  const idSource = str(disamb?.['disambiguation-source']);
  const idValue = str(disamb?.['disambiguated-organization-identifier']);
  const endDate = partialDate(summary['end-date']);
  const url = value(summary.url);
  return {
    kind,
    organization,
    department: str(summary['department-name']),
    role: str(summary['role-title']),
    startDate: partialDate(summary['start-date']),
    endDate,
    current: !endDate,
    city: str(address?.city),
    region: str(address?.region),
    country: str(address?.country),
    orgId: idSource && idValue ? { source: idSource, value: idValue } : null,
    ror:
      idSource === 'ROR' && idValue
        ? idValue.startsWith('https://')
          ? idValue
          : `https://ror.org/${idValue}`
        : null,
    url: url && /^https?:\/\//.test(url) ? url : null,
    source: value(obj(summary.source)?.['source-name']),
    visibility: str(summary.visibility),
    putCode: typeof summary['put-code'] === 'number' ? summary['put-code'] : null,
  };
}

/** Grupos de afiliación de ORCID (`affiliation-group[].summaries[]["<tipo>-summary"]`). */
function affiliations(section: unknown, kind: AffiliationKind): OrcidAffiliation[] {
  const groups = obj(section)?.['affiliation-group'];
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((g) => {
    const summaries = obj(g)?.summaries;
    return (Array.isArray(summaries) ? summaries : [])
      .map((s) => obj(obj(s)?.[`${kind}-summary`]))
      .filter((s): s is Raw => !!s)
      .map((s) => toAffiliation(s, kind))
      .filter((a): a is OrcidAffiliation => !!a);
  });
}

/** Vigentes primero; luego por fecha de inicio, la más reciente primero. */
const byRecency = (a: OrcidAffiliation, b: OrcidAffiliation) =>
  Number(b.current) - Number(a.current) || (b.startDate ?? '').localeCompare(a.startDate ?? '');

/** Registro de ORCID → perfil normalizado (lista blanca de campos públicos). */
export function toOrcidProfile(record: unknown): OrcidProfile | null {
  const r = obj(record);
  const orcid = str(obj(r?.['orcid-identifier'])?.path);
  if (!r || !orcid) return null;
  const person = obj(r.person);
  const name = obj(person?.name);
  const given = value(name?.['given-names']);
  const [first, ...rest] = (given ?? '').split(/\s+/).filter(Boolean);
  const familyName = value(name?.['family-name']);
  const publishedName = value(name?.['credit-name']);
  const addresses = obj(person?.addresses)?.address;
  const history = obj(r.history);
  const activities = obj(r['activities-summary']);
  return {
    orcid,
    uri: `https://orcid.org/${orcid}`,
    givenName: first ?? null,
    middleName: rest.length ? rest.join(' ') : null,
    familyName,
    publishedName,
    displayName: publishedName ?? ([given, familyName].filter(Boolean).join(' ') || orcid),
    biography: str(obj(person?.biography)?.content),
    country: Array.isArray(addresses) ? value(obj(addresses[0])?.country) : null,
    createdAt: isoFromMillis(history?.['submission-date']),
    lastModifiedAt: isoFromMillis(history?.['last-modified-date']),
    employments: [
      ...affiliations(activities?.employments, 'employment'),
      ...affiliations(activities?.['invited-positions'], 'invited-position'),
    ].sort(byRecency),
    educations: [
      ...affiliations(activities?.educations, 'education'),
      ...affiliations(activities?.qualifications, 'qualification'),
    ].sort(byRecency),
  };
}

/** Perfil público por ORCID; null si no existe (404) o está desactivado. Errores de red/servidor: excepción. */
export async function fetchOrcidProfile(
  orcid: string,
  base = DEFAULT_ORCID_URL,
): Promise<OrcidProfile | null> {
  const r = await fetch(`${base.replace(/\/+$/, '')}/${orcid}/record`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status === 404 || r.status === 409) return null; // 409: registro desactivado o bloqueado
  if (!r.ok) throw new Error(`ORCID ${orcid}: HTTP ${r.status}`);
  return toOrcidProfile(await r.json());
}

/** Escapa la sintaxis Lucene de ORCID: el texto del usuario se busca literal, nunca como consulta. */
export const escapeLucene = (term: string) => term.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&');

/**
 * Búsqueda por nombre (API pública: expanded-search). Lista blanca: ORCID, nombre e instituciones
 * (se descarta `email` aunque ORCID lo envíe cuando es público).
 */
export async function searchOrcid(term: string, base = DEFAULT_ORCID_URL, rows = 8): Promise<OrcidSearchHit[]> {
  const words = term.trim().split(/\s+/).map(escapeLucene).join(' ');
  const q = `given-and-family-names:(${words}) OR other-names:(${words})`;
  const r = await fetch(`${base.replace(/\/+$/, '')}/expanded-search/?q=${encodeURIComponent(q)}&rows=${rows}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`ORCID búsqueda: HTTP ${r.status}`);
  const results = obj(await r.json())?.['expanded-result'];
  return (Array.isArray(results) ? results : []).flatMap((raw) => {
    const hit = obj(raw);
    const orcid = str(hit?.['orcid-id']);
    const name = (str(hit?.['credit-name']) ?? [str(hit?.['given-names']), str(hit?.['family-names'])].filter(Boolean).join(' '))
      .replace(/\s+/g, ' ')
      .trim();
    const institutions = Array.isArray(hit?.['institution-name'])
      ? [...new Set((hit['institution-name'] as unknown[]).map(str).filter((s): s is string => !!s))].slice(0, 3)
      : [];
    return orcid && name ? [{ orcid, name, institutions }] : [];
  });
}
