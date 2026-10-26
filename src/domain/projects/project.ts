import type { OdsId } from '../ods/ods';
import { authorSlug, slugify } from '../authors/author.ts';

/** Producto de un proyecto (artículo, software, patente…), tal como lo registra Metri-K. */
export interface ProjectProduct {
  title: string;
  /** Tipología, p. ej. "Artículo de investigación", "Apropiación Social". */
  type: string | null;
  subtype: string | null;
  year: number | null;
  /** "Publicado", "En desarrollo", "Registrado"… */
  status: string | null;
  url: string | null;
}

/** Proyecto seleccionado para divulgación (fuente: Metri-K `/proyectos/seleccionados`). */
export interface Project {
  id: number;
  code: string;
  title: string;
  /** Nombres de los centros (Metri-K no da su id). */
  centers: string[];
  /** Nombres de los grupos (Metri-K no da su id). */
  groups: string[];
  area: string | null;
  year: number | null;
  /** Inicio y fin, p. ej. 2024 y 2025 (de "2024 - 2025"). */
  startYear: number | null;
  endYear: number | null;
  status: string | null;
  funder: string | null;
  allies: string | null;
  /** Texto libre, p. ej. "$1.126.642.650" o "USD 196.967". */
  resources: string | null;
  territory: string | null;
  problem: string | null;
  solution: string | null;
  objective: string | null;
  results: string | null;
  beneficiaries: string | null;
  /** Texto libre con enlaces (la página los vuelve clicables). */
  evidence: string | null;
  ods: OdsId[];
  /** Solo nombres: Metri-K manda la cédula del líder. */
  leaders: string[];
  products: ProjectProduct[];
  /** Foto principal (la de la lista), subida en /admin/proyectos/fotos. */
  photoUrl: string | null;
  /** Fotos asociadas; `slot` es su posición en el almacén (1…12). */
  gallery: { slot: number; url: string }[];
}

export interface ProjectRepository {
  list(signal?: AbortSignal): Promise<Project[]>;
  /** null si no existe. */
  getById(id: number, signal?: AbortSignal): Promise<Project | null>;
}

/** Metri-K da los centros del proyecto por nombre: se cruzan sin tildes ni mayúsculas. */
export const projectsOfCenter = (projects: Project[], centerName: string) =>
  projects.filter((p) => p.centers.some((c) => slugify(c) === slugify(centerName)));

export const isRunning = (p: Pick<Project, 'status'>) => /ejecuci/i.test(p.status ?? '');

/** Los títulos son largos: el slug toma las primeras 8 palabras. */
export const projectSlug = (p: Pick<Project, 'id' | 'title'>) =>
  authorSlug({ id: p.id, name: p.title.split(/\s+/).slice(0, 8).join(' ') });

/** Avance temporal 0–100 según los años del periodo (null si no hay periodo). */
export function timeProgress(p: Pick<Project, 'startYear' | 'endYear'>, now = new Date()): number | null {
  if (!p.startYear || !p.endYear) return null;
  const start = Date.UTC(p.startYear, 0, 1);
  const end = Date.UTC(p.endYear + 1, 0, 1);
  return Math.round(Math.min(1, Math.max(0, (now.getTime() - start) / (end - start))) * 100);
}

/** En ejecución primero; luego los más recientes. */
export const sortProjects = (projects: Project[]) =>
  [...projects].sort(
    (a, b) => Number(isRunning(b)) - Number(isRunning(a)) || (b.year ?? 0) - (a.year ?? 0) || a.id - b.id,
  );

export interface ProjectFilters {
  search: string;
  /** Nombre del centro. */
  center: string | null;
  status: string | null;
}

/** Búsqueda sin tildes por título, código, líder, centro, grupo o financiador. */
export function filterProjects(projects: Project[], f: ProjectFilters): Project[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(f.search.trim());
  return projects.filter(
    (p) =>
      (!f.center || p.centers.some((c) => slugify(c) === slugify(f.center!))) &&
      (!f.status || p.status === f.status) &&
      (!q ||
        [p.title, p.code, p.funder ?? '', ...p.leaders, ...p.centers, ...p.groups].some((s) =>
          norm(s).includes(q),
        )),
  );
}
