/**
 * ORCID iD y perfil público de un investigador (dominio puro: lo usan el BFF, el navegador y los tests).
 * La fuente es la API pública oficial de ORCID (pub.orcid.org v3.0): solo información pública.
 */

/** Dígito de control ISO 7064 MOD 11-2 sobre los 15 primeros dígitos. */
export function orcidChecksum(base15: string): string {
  let total = 0;
  for (const digit of base15) total = (total + Number(digit)) * 2;
  const result = (12 - (total % 11)) % 11;
  return result === 10 ? 'X' : String(result);
}

/**
 * ORCID canónico ("0000-0002-1825-0097") o null si no es válido.
 * Acepta la URL (https://orcid.org/…), sin guiones o con espacios. Mismo algoritmo que el backend.
 */
export function normalizeOrcid(raw: string | null | undefined): string | null {
  const value = (raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/^(HTTPS?:\/\/)?(WWW\.)?ORCID\.ORG\//, '')
    .replace(/[-\s]/g, '');
  if (!/^\d{15}[\dX]$/.test(value) || orcidChecksum(value.slice(0, 15)) !== value[15]) return null;
  return value.match(/.{4}/g)!.join('-');
}

export const orcidUrl = (orcid: string) => `https://orcid.org/${orcid}`;

/** Fecha parcial de ORCID: "2020", "2020-03" o "2020-03-15". */
export type PartialDate = string;

export type AffiliationKind = 'employment' | 'invited-position' | 'education' | 'qualification';

/** Empleo o formación. En ORCID el "role-title" es el cargo (empleo) o el título/programa (educación). */
export interface OrcidAffiliation {
  kind: AffiliationKind;
  organization: string;
  department: string | null;
  role: string | null;
  startDate: PartialDate | null;
  endDate: PartialDate | null;
  current: boolean;
  city: string | null;
  region: string | null;
  country: string | null;
  /** Identificador desambiguado de la organización (ROR, RINGGOLD, GRID, FUNDREF…). */
  orgId: { source: string; value: string } | null;
  /** URL ROR de la institución, si la fuente es ROR. */
  ror: string | null;
  url: string | null;
  /** Quién registró el dato (el investigador o una institución) y su visibilidad. */
  source: string | null;
  visibility: string | null;
  putCode: number | null;
}

export interface OrcidProfile {
  orcid: string;
  uri: string;
  givenName: string | null;
  middleName: string | null;
  familyName: string | null;
  /** Nombre publicado ("credit name") que el investigador eligió mostrar. */
  publishedName: string | null;
  /** Nombre para mostrar: el publicado o, si no hay, nombres + apellidos. */
  displayName: string;
  biography: string | null;
  country: string | null;
  createdAt: string | null;
  lastModifiedAt: string | null;
  employments: OrcidAffiliation[];
  educations: OrcidAffiliation[];
}

/** Afiliación para mostrar "Cargo · Institución": el empleo vigente, luego cualquier vigente, luego la más reciente. */
export function currentAffiliation(p: OrcidProfile): OrcidAffiliation | null {
  return (
    p.employments.find((a) => a.current && a.kind === 'employment') ??
    p.employments.find((a) => a.current) ??
    p.employments[0] ??
    null
  );
}

/** Resultado de búsqueda por nombre en ORCID (solo lo necesario para elegir a la persona). */
export interface OrcidSearchHit {
  orcid: string;
  name: string;
  institutions: string[];
}
