// Fuente de grupos (Metri-K, `GET /back/api/group`). SOLO servidor: la respuesta original trae
// cédulas, correos, teléfonos, etnia y hashes de contraseña. Aquí se proyecta a una lista blanca
// de campos públicos; nada más sale de este módulo.

import type { CategoryRecord, GroupDetail, GroupInfo, GroupLine } from '../src/domain/groups/group.ts';
import { normalizeOds } from '../src/domain/ods/ods.ts';

export type Raw = Record<string, unknown>;
export const obj = (v: unknown): Raw | null => (v && typeof v === 'object' ? (v as Raw) : null);
export const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const httpsUrl = (v: unknown, host: RegExp): string | null => {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && host.test(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
};

/** "RODRIGUEZ LARA, INES EMILIA" → "INES EMILIA RODRIGUEZ LARA" (el front le da formato). */
/**
 * Nombres + apellidos de `person`. `name_standard` (forma de citación, a veces con variantes:
 * "RODRIGUEZ LARA, INES EMILIA, RODRIGUEZ, I.") solo si faltan: se toma la primera variante.
 */
export function fullName(raw: Raw): string | null {
  const person = obj(raw.person);
  const own = [str(person?.name), str(person?.lastname)].filter(Boolean).join(' ');
  if (own) return own;
  const [last, first] = (str(raw.name_standard) ?? '').split(',').map((s) => s.trim());
  return (first ? `${first} ${last}` : last) || null;
}

export function toPublicGroup(raw: Raw): GroupInfo | null {
  const id = raw.id;
  const name = str(raw.name);
  const code = str(raw.code);
  if (typeof id !== 'number' || !name || !code) return null;

  const leader = obj(raw.leader);
  const lName = leader ? fullName(leader) : null;
  const municipality = obj(raw.municipality);
  const city = str(municipality?.name);
  const orcid = str(leader?.orcid)?.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/)?.[0] ?? null;
  const year = Number(str(raw.date_created)?.slice(0, 4));

  return {
    id,
    code,
    name,
    active: raw.state === true,
    type: str(raw.type),
    category: str(raw.lastCategory)?.toUpperCase() ?? null,
    gruplacUrl: httpsUrl(raw.url, /(^|\.)minciencias\.gov\.co$/),
    city: city && city !== 'N/A' ? city : null,
    department: city && city !== 'N/A' ? str(obj(municipality?.department)?.name) : null,
    foundedYear: Number.isInteger(year) && year > 1900 ? year : null,
    leader: lName
      ? {
          name: lName,
          orcid,
          cvlacUrl: httpsUrl(leader?.cvlac, /(^|\.)minciencias\.gov\.co$/),
          scholarUrl: httpsUrl(leader?.google_scholar, /(^|\.)scholar\.google\.[a-z.]+$/),
          scopusId: str(leader?.id_scopus)?.match(/^\d{6,15}$/)?.[0] ?? null,
        }
      : null,
    ods: [], // se completan en fetchPublicGroups (Metri-K `/ods/group/{id}`)
    // De cada centro solo el id (y solo activos): el objeto trae los datos personales del director.
    centerIds: [
      ...new Set(
        (Array.isArray(raw.centers) ? raw.centers : [])
          .map(obj)
          .filter((c) => c?.state === true && typeof c.id === 'number' && c.id > 0)
          .map((c) => c!.id as number),
      ),
    ].sort((a, b) => a - b),
  };
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/**
 * Texto copiado de Word en Metri-K: entidades HTML sin decodificar (`&#61532;`) y viñetas
 * de fuentes de símbolos (zona de uso privado de Unicode). Se dejan como texto plano legible.
 */
export function cleanText(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return (
    s
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&#x([\da-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, k: string) => NAMED[k]!)
      .replace(/[-]/g, '•')
      .trim() || null
  );
}

export function toPublicLine(raw: Raw): GroupLine | null {
  const name = str(raw.name);
  if (typeof raw.id !== 'number' || !name || raw.state === false) return null;
  return {
    id: raw.id,
    code: str(raw.code),
    name,
    objective: cleanText(raw.objective),
    achievements: cleanText(raw.achievements),
    impact: cleanText(raw.impact),
  };
}

export function toCategoryRecord(raw: Raw): (CategoryRecord & { date: string }) | null {
  const conv = obj(raw.convocation);
  const convocation = str(conv?.nombre);
  const category = str(raw.category);
  if (!convocation || !category) return null;
  const date = str(conv?.fecha_inicio) ?? '';
  const year = Number(date.slice(0, 4));
  return { convocation, category, year: Number.isInteger(year) && year > 1900 ? year : null, date };
}

export async function getData(url: string): Promise<unknown[]> {
  const r = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Metri-K ${url}: HTTP ${r.status}`);
  const body = obj(await r.json());
  if (!Array.isArray(body?.data)) throw new Error(`Metri-K ${url}: formato inesperado (falta \`data\`)`);
  return body.data;
}

/** map con a lo sumo `limit` promesas en vuelo (no saturar Metri-K con 47 peticiones a la vez). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Grupos + líneas, ya proyectados. `groupsUrl` es `.../api/group`; las líneas viven en
 * `.../api/lineGroup/group/{id}` (mismo backend).
 */
export async function fetchPublicGroups(groupsUrl: string): Promise<GroupDetail[]> {
  const base = groupsUrl.replace(/\/group\/?$/, '');
  const groups = (await getData(groupsUrl)).flatMap((g) => {
    const p = obj(g) && toPublicGroup(g as Raw);
    return p ? [p] : [];
  });
  const project = <T>(rows: unknown[], fn: (r: Raw) => T | null): T[] =>
    rows.flatMap((r) => {
      const p = obj(r) && fn(r as Raw);
      return p ? [p] : [];
    });
  return mapLimit(groups, 6, async (g) => {
    const [lines, history, ods] = await Promise.all([
      getData(`${base}/lineGroup/group/${g.id}`),
      getData(`${base}/group/categories/${g.id}`),
      getData(`${base}/ods/group/${g.id}`),
    ]);
    return {
      ...g,
      // De cada ODS solo el número (título y descripción ya están en el catálogo del portal).
      ods: normalizeOds(project(ods, (o) => Number(str(o.number)))),
      lines: project(lines, toPublicLine),
      categoryHistory: project(history, toCategoryRecord)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ date: _date, ...r }) => r),
    };
  });
}
