// Fuente de proyectos (Metri-K, `GET /proyectos/seleccionados`). SOLO servidor: cada líder trae su
// cédula. Aquí se proyecta a una lista blanca de campos públicos; nada más sale de este módulo.
import type { Project, ProjectProduct } from '../src/domain/projects/project.ts';
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

export function toPublicProject(raw: Raw): Project | null {
  const id = raw.id;
  const title = str(raw.titulo);
  const code = str(raw.codigo);
  if (typeof id !== 'number' || !title || !code) return null;
  const [startYear = null, endYear = null] = (str(raw.periodo)?.match(/\d{4}/g) ?? []).map(Number);
  return {
    id,
    code,
    title,
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
    // Solo el nombre: la cédula no sale de aquí.
    leaders: (Array.isArray(raw.lideres) ? raw.lideres : [])
      .map((l) => str(obj(l)?.nombre))
      .filter((n) => !!n) as string[],
    // Metri-K no aloja fotos: las asigna el portal (public-api.ts, /admin/proyectos/fotos).
    photoUrl: null,
    gallery: [],
    products: (Array.isArray(raw.productos) ? raw.productos : []).flatMap((p) => {
      const r = obj(p) && toProduct(p as Raw);
      return r ? [r] : [];
    }),
  };
}

/** `base` es `.../back/api`. */
export async function fetchPublicProjects(base: string): Promise<Project[]> {
  return (await getData(`${base}/proyectos/seleccionados`)).flatMap((r) => {
    const p = obj(r) && toPublicProject(r as Raw);
    return p ? [p] : [];
  });
}
