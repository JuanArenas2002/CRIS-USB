// Fuente de centros de investigación (Metri-K). SOLO servidor: `/center` trae del director su
// documento, correo, teléfono, fecha de nacimiento, género… Aquí se proyecta a una lista blanca de
// campos públicos (nombre e identificadores académicos); nada más sale de este módulo.
//   GET /center                          → centros
//   GET /lineCenter/center/{id}          → líneas
//   GET /ods/center/{id}                 → ODS
//   GET /resolutionCenter/center/{id}    → resoluciones, con el PDF en base64 dentro (`file`)
//   GET /center/investigator/{id}        → centros a los que aporta un investigador
import type { CenterDetail, CenterLine, CenterRef, CenterResolution } from '../src/domain/centers/center.ts';
import { normalizeOds } from '../src/domain/ods/ods.ts';
import { cleanText, getData, httpsUrl, mapLimit, obj, str, type Raw } from './groups-source.ts';

type CenterBase = Omit<CenterDetail, 'lines' | 'resolutions' | 'ods' | 'linesCount' | 'logoUrl' | 'website'>;

/** Centro público; null para registros vacíos (Metri-K tiene un `id 0` con todo en "N/A"). */
export function toPublicCenter(raw: Raw): CenterBase | null {
  const id = raw.id;
  const name = str(raw.name);
  const code = str(raw.code);
  if (typeof id !== 'number' || !name || !code || name === 'N/A' || code === 'N/A') return null;

  const director = obj(raw.director);
  const person = obj(director?.person);
  // name_standard no es fiable (a veces es una lista de variantes): nombre y apellidos de la persona.
  const dName = [str(person?.name), str(person?.lastname)].filter(Boolean).join(' ') || null;
  const municipality = obj(raw.municipality);
  const city = str(municipality?.name);
  const createdAt = str(raw.date_created)?.slice(0, 10) ?? null;
  const year = Number(createdAt?.slice(0, 4));
  const acronym = str(raw.acronym);
  const dane = str(municipality?.code);

  return {
    id,
    code,
    acronym: acronym && acronym !== 'N/A' ? acronym : null,
    name,
    active: raw.state === true,
    createdAt: createdAt && /^\d{4}-\d{2}-\d{2}$/.test(createdAt) ? createdAt : null,
    foundedYear: Number.isInteger(year) && year > 1900 ? year : null,
    city: city && city !== 'N/A' ? city : null,
    department: city && city !== 'N/A' ? str(obj(municipality?.department)?.name) : null,
    daneCode: dane && /^\d{5}$/.test(dane) ? dane : null,
    director:
      dName && dName !== 'N/A'
        ? {
            name: dName,
            orcid: str(director?.orcid)?.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/)?.[0] ?? null,
            cvlacUrl: httpsUrl(director?.cvlac, /(^|\.)minciencias\.gov\.co$/),
            scholarUrl: httpsUrl(director?.google_scholar, /(^|\.)scholar\.google\.[a-z.]+$/),
            // A veces trae varios ids separados por ";": el primero.
            scopusId: str(director?.id_scopus)?.match(/\d{6,15}/)?.[0] ?? null,
          }
        : null,
  };
}

export function toCenterLine(raw: Raw): CenterLine | null {
  const name = str(raw.name);
  if (typeof raw.id !== 'number' || !name || raw.state === false) return null;
  return { id: raw.id, code: str(raw.code), name };
}

/** Metadatos de la resolución; el PDF (`file`, base64) no viaja en el listado. */
export function toCenterResolution(raw: Raw): CenterResolution | null {
  if (typeof raw.id !== 'number') return null;
  const date = str(raw.date)?.slice(0, 10) ?? null;
  return {
    id: raw.id,
    number: str(raw.number)?.replace(/_/g, ' ') ?? null,
    type: str(raw.type),
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    description: cleanText(raw.description),
    hasFile: isPdfBase64(raw.file),
  };
}

/** El PDF viene en base64: empieza por "JVBERi" ("%PDF-"). */
const isPdfBase64 = (v: unknown): v is string => typeof v === 'string' && v.startsWith('JVBERi');

const project = <T>(rows: unknown[], fn: (r: Raw) => T | null): T[] =>
  rows.flatMap((r) => {
    const p = obj(r) && fn(r as Raw);
    return p ? [p] : [];
  });

/** Centros con líneas, ODS y resoluciones, ya proyectados. `base` es `.../back/api`. */
export async function fetchPublicCenters(base: string): Promise<CenterDetail[]> {
  const centers = project(await getData(`${base}/center`), toPublicCenter);
  return mapLimit(centers, 4, async (c) => {
    const [lines, ods, resolutions] = await Promise.all([
      getData(`${base}/lineCenter/center/${c.id}`),
      getData(`${base}/ods/center/${c.id}`),
      getData(`${base}/resolutionCenter/center/${c.id}`),
    ]);
    const centerLines = project(lines, toCenterLine);
    return {
      ...c,
      ods: normalizeOds(project(ods, (o) => Number(str(o.number)))),
      linesCount: centerLines.length,
      // Metri-K no los tiene: los asigna el portal (public-api.ts, /admin/centros).
      logoUrl: null,
      website: null,
      lines: centerLines,
      resolutions: project(resolutions, toCenterResolution).sort((a, b) =>
        (b.date ?? '').localeCompare(a.date ?? ''),
      ),
    };
  });
}

/** PDF de una resolución (null si no existe o no es un PDF). Se pide bajo demanda: pesa megas. */
export async function fetchResolutionPdf(
  base: string,
  centerId: number,
  resolutionId: number,
): Promise<{ pdf: Buffer; name: string } | null> {
  const rows = await getData(`${base}/resolutionCenter/center/${centerId}`);
  const raw = rows.map(obj).find((r) => r?.id === resolutionId);
  if (!raw || !isPdfBase64(raw.file)) return null;
  const name = (str(raw.number) ?? `resolucion-${resolutionId}`).replace(/[^\w.-]+/g, '_');
  return { pdf: Buffer.from(raw.file, 'base64'), name: `${name}.pdf` };
}

/** Centros activos a los que aporta un investigador (solo referencia pública). */
export async function fetchInvestigatorCenters(base: string, id: number): Promise<CenterRef[]> {
  return project(await getData(`${base}/center/investigator/${id}`), (r) => {
    const c = toPublicCenter(r);
    return c && c.active ? { id: c.id, code: c.code, acronym: c.acronym, name: c.name } : null;
  });
}
