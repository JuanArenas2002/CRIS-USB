import type { Author } from '../authors/author';
import type { OdsId } from '../ods/ods';

/** Datos públicos de un grupo de investigación. */
export interface GroupInfo {
  id: number;
  code: string;
  name: string;
  active: boolean;
  type: string | null;
  /** Última categoría Minciencias (A1, A, B, C) o null. */
  category: string | null;
  gruplacUrl: string | null;
  city: string | null;
  department: string | null;
  foundedYear: number | null;
  leader: {
    name: string;
    orcid: string | null;
    cvlacUrl: string | null;
    scholarUrl: string | null;
    scopusId: string | null;
  } | null;
  /** ODS asignados en el portal (Metri-K aún no los tiene); ascendentes, sin repetir. */
  ods: OdsId[];
}

/** Línea de investigación de un grupo. Los textos son null cuando Metri-K no los tiene. */
export interface GroupLine {
  id: number;
  code: string | null;
  name: string;
  objective: string | null;
  achievements: string | null;
  impact: string | null;
}

/** Para listados: solo el nombre de cada línea (los textos pesan ~10 KB por grupo). */
export interface Group extends GroupInfo {
  lines: Pick<GroupLine, 'id' | 'name'>[];
}

/** Resultado del grupo en una convocatoria Minciencias. */
export interface CategoryRecord {
  convocation: string;
  year: number | null;
  /** A1, A, B, C, D o "Reconocido". */
  category: string;
}

export interface GroupDetail extends GroupInfo {
  lines: GroupLine[];
  /** De la convocatoria más antigua a la más reciente. */
  categoryHistory: CategoryRecord[];
}

export function summarizeGroup({ categoryHistory: _omit, ...g }: GroupDetail): Group {
  return { ...g, lines: g.lines.map(({ id, name }) => ({ id, name })) };
}

/** Altura relativa de cada categoría para la línea de tiempo (A1 arriba). */
export const CATEGORY_LEVEL: Record<string, number> = { A1: 5, A: 4, B: 3, C: 2, D: 1, RECONOCIDO: 0 };

/** Integrante de un grupo: solo se enlaza su perfil si el portal lo publica. */
export type GroupMember = Author & { profilePublished: boolean };

export interface GroupRepository {
  list(signal?: AbortSignal): Promise<Group[]>;
  members(id: number, signal?: AbortSignal): Promise<GroupMember[]>;
  /** null si no existe. */
  getById(id: number, signal?: AbortSignal): Promise<GroupDetail | null>;
}

export const CATEGORY_ORDER = ['A1', 'A', 'B', 'C'] as const;

const rank = (c: string | null) => {
  const i = CATEGORY_ORDER.indexOf((c ?? '') as (typeof CATEGORY_ORDER)[number]);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

/** Mejor categoría primero; a igual categoría, alfabético. */
export function sortGroups(groups: Group[]): Group[] {
  return [...groups].sort(
    (a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name, 'es'),
  );
}

export interface GroupFilters {
  search: string;
  category: string | null;
}

/**
 * El endpoint de grupos no filtra ni pagina; con ~50 registros se filtra en memoria.
 * ponytail: si el catálogo crece a cientos, mover búsqueda y paginación al backend.
 */
export function filterGroups(groups: Group[], { search, category }: GroupFilters): Group[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(search.trim());
  return groups.filter(
    (g) =>
      (!category || g.category === category) &&
      (!q ||
        [g.name, g.code, g.leader?.name ?? '', g.city ?? '', ...g.lines.map((l) => l.name)].some((f) =>
          norm(f).includes(q),
        )),
  );
}
