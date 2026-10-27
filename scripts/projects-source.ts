// Fuente de proyectos (Metri-K, `GET /proyectos/seleccionados`). SOLO servidor: cada líder trae su
// cédula. Aquí se proyecta a una lista blanca de campos públicos; nada más sale de este módulo.
import { projectTitle, type Project, type ProjectProduct } from '../src/domain/projects/project.ts';
import { normalizeOds } from '../src/domain/ods/ods.ts';
import { getData, obj, str, type Raw } from './groups-source.ts';

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : [];
const int = (v: unknown): number | null => (Number.isInteger(v) ? (v as number) : null);
const webUrl = (v: unknown): string | null => {
  const s = str(v);
  return s && /^https?:\/\/\S+$/.test(s) ? s : null;
};

function toProduct(raw: Raw): ProjectProduct | null {
  const title = str(raw.titulo);
  return title
    ? {
        title,
        type: str(raw.tipo),
        subtype: str(raw.subtipo),
        year: int(raw.anio),
        status: str(raw.estado),
        url: webUrl(raw.url),
      }
    : null;
}

/** Integrante tal como lo guarda Metri-K en `personal` (la cédula solo la ve el admin del centro). */
export interface ProjectStaff {
  cedula: string | null;
  nombreCompleto: string;
  rol: string | null;
}

export const toStaff = (raw: unknown): ProjectStaff | null => {
  const r = obj(raw);
  const nombreCompleto = str(r?.nombreCompleto) ?? str(r?.nombre);
  return nombreCompleto ? { cedula: str(r?.cedula), nombreCompleto, rol: str(r?.rol) } : null;
};
const staffOf = (raw: Raw) =>
  (Array.isArray(raw.personal) ? raw.personal : []).flatMap((x) => toStaff(x) ?? []);

/** `personal` (con rol) y, si falta, los `lideres` antiguos (sin rol); sin repetir nombres. */
function toTeam(raw: Raw): Project['team'] {
  const team = staffOf(raw).map((s) => ({ name: s.nombreCompleto, role: s.rol }));
  for (const l of Array.isArray(raw.lideres) ? raw.lideres : []) {
    const name = str(obj(l)?.nombre);
    if (name && !team.some((m) => m.name === name)) team.push({ name, role: null });
  }
  return team;
}

export function toPublicProject(raw: Raw): Project | null {
  const id = raw.id;
  const title = str(raw.titulo);
  const code = str(raw.codigo);
  if (typeof id !== 'number' || !title || !code) return null;
  const [startYear = null, endYear = null] = (str(raw.periodo)?.match(/\d{4}/g) ?? []).map(Number);
  return {
    id,
    code,
    title: projectTitle(title),
    centers: strings(raw.centros),
    groups: strings(raw.grupos),
    area: str(raw.areaOcde),
    year: int(raw.year),
    startYear,
    endYear: endYear ?? startYear,
    status: str(raw.estadoProyecto),
    funder: str(raw.entidadFinanciadora),
    allies: str(raw.aliados),
    resources: str(raw.recursosMovilizados),
    territory: str(raw.empresaTerritorio),
    problem: str(raw.problema),
    solution: str(raw.solucion),
    objective: str(raw.objetivo),
    results: str(raw.resultados),
    beneficiaries: str(raw.beneficiarios),
    evidence: str(raw.evidencias),
    // "ODS 5: Igualdad de género" → 5
    ods: normalizeOds(strings(raw.ods).map((s) => Number(/\d+/.exec(s)?.[0]))),
    // Solo nombre y rol: la cédula no sale de aquí.
    team: toTeam(raw),
    // Metri-K no aloja fotos: las asigna el portal (public-api.ts, /admin/proyectos/fotos).
    photoUrl: null,
    gallery: [],
    products: (Array.isArray(raw.productos) ? raw.productos : []).flatMap((p) => {
      const r = obj(p) && toProduct(p as Raw);
      return r ? [r] : [];
    }),
  };
}

// ── Equipo del proyecto en Metri-K (solo desde el BFF, tras token + contraseña del centro) ──
// Metri-K no autentica estas rutas: el BFF es quien decide quién puede llamarlas.

/** Equipo con cédulas, leído en vivo (sin caché) para el admin. */
export async function fetchStaff(base: string, projectId: number): Promise<ProjectStaff[]> {
  const raw = (await getData(`${base}/proyectos/seleccionados`)).map(obj).find((r) => r?.id === projectId);
  return raw ? staffOf(raw) : [];
}

async function metrikWrite(url: string, method: 'PATCH' | 'DELETE', body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) {
    const detail = str(obj(await r.json().catch(() => null))?.message);
    throw new Error(`Metri-K respondió ${r.status}${detail ? `: ${detail}` : ''}`);
  }
}

/** Agrega (o actualiza) una persona: `PATCH /proyectos/seleccionados/:id/personal`. */
export const saveStaff = (base: string, projectId: number, s: ProjectStaff) =>
  metrikWrite(`${base}/proyectos/seleccionados/${projectId}/personal`, 'PATCH', {
    ...(s.cedula ? { cedula: s.cedula } : {}),
    nombreCompleto: s.nombreCompleto,
    rol: s.rol,
  });

/** Quita a una persona por cédula: `DELETE /proyectos/seleccionados/:id/personal/:cedula`. */
export const removeStaff = (base: string, projectId: number, cedula: string) =>
  metrikWrite(
    `${base}/proyectos/seleccionados/${projectId}/personal/${encodeURIComponent(cedula)}`,
    'DELETE',
  );

/** `base` es `.../back/api`. */
export async function fetchPublicProjects(base: string): Promise<Project[]> {
  return (await getData(`${base}/proyectos/seleccionados`)).flatMap((r) => {
    const p = obj(r) && toPublicProject(r as Raw);
    return p ? [p] : [];
  });
}
