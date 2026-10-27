import type { OdsId } from '../ods/ods';
import { authorSlug, slugify, type Product, type TypologyId } from '../authors/author.ts';

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

/** Integrante del equipo del proyecto. El rol es texto libre (Investigador Principal, Co investigador…). */
export interface ProjectMember {
  name: string;
  role: string | null;
}

/** Roles sugeridos en el admin; Metri-K acepta cualquier texto. */
export const PROJECT_ROLES = ['Investigador Principal', 'Co investigador', 'Estudiante'] as const;

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
  /** Equipo (Metri-K `personal`): solo nombre y rol; la cédula no sale del servidor. */
  team: ProjectMember[];
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

/**
 * Títulos que Metri-K trae en mayúsculas → tipo oración, por tramos separados por guion
 * ("IMPLEMENTACIÓN DE … - Puerta de Oro"). Un tramo de una sola palabra en mayúsculas es una
 * sigla (AGROBAC, CADI) y se deja igual; los tramos que ya tienen minúsculas no se tocan.
 * ponytail: los nombres propios dentro de un tramo en mayúsculas quedan en minúscula
 * ("ciénaga de mallorquín"); corregirlo exige un diccionario o que Metri-K guarde bien el título.
 */
export function projectTitle(title: string): string {
  return title
    .split(/(\s+[-–]\s+)/)
    .map((part) => {
      const letters = part.replace(/[^\p{L}]/gu, '');
      const isUpper = letters.length > 0 && letters === letters.toUpperCase();
      if (!isUpper || !/\s/.test(part.trim())) return part;
      return part.toLowerCase().replace(/\p{L}/u, (c) => c.toUpperCase());
    })
    .join('');
}

/** Tipología Minciencias según el tipo que registra Metri-K en el proyecto. */
function typologyOf(type: string | null): TypologyId {
  const t = (type ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (/apropiacion/.test(t)) return 'ASC';
  if (/formacion|tesis|trabajo de grado/.test(t)) return 'FRH';
  if (/software|patente|prototipo|desarrollo|tecnolog/.test(t)) return 'DTI';
  return 'GNC';
}

/** Productos del proyecto en el formato de la tabla de productos del investigador. */
export const projectProducts = (p: Pick<Project, 'id' | 'products'>): Product[] =>
  p.products
    .map((x, i) => ({
      key: `${p.id}-${i}`,
      typology: typologyOf(x.type),
      // El subtipo es el tipo concreto ("Artículo en revista indexada"); el tipo, la familia.
      type: x.subtype ?? x.type ?? '—',
      title: x.title,
      authors: null,
      year: x.year,
      venue: null,
      index: x.status,
      doi: x.url?.match(/doi\.org\/(10\.\S+)/)?.[1] ?? null,
      url: x.url,
    }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

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
        [p.title, p.code, p.funder ?? '', ...p.team.map((m) => m.name), ...p.centers, ...p.groups].some((s) =>
          norm(s).includes(q),
        )),
  );
}
