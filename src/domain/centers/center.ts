import type { OdsId } from '../ods/ods';

/** Director del centro: solo nombre e identificadores académicos públicos. */
export interface CenterDirector {
  name: string;
  orcid: string | null;
  cvlacUrl: string | null;
  scholarUrl: string | null;
  scopusId: string | null;
}

/** Datos públicos de un centro de investigación (fuente: Metri-K `/center`). */
export interface Center {
  id: number;
  /** Código institucional, p. ej. "CI-1". */
  code: string;
  /** Sigla, p. ej. "MACONDOLAB". */
  acronym: string | null;
  name: string;
  active: boolean;
  /** Fecha de creación, AAAA-MM-DD. */
  createdAt: string | null;
  foundedYear: number | null;
  city: string | null;
  department: string | null;
  /** Código DANE del municipio de la sede, p. ej. "08001". */
  daneCode: string | null;
  director: CenterDirector | null;
  /** ODS a los que aporta el centro (Metri-K `/ods/center/{id}`), ascendentes. */
  ods: OdsId[];
  linesCount: number;
  /** Logo subido en /admin/centros (Metri-K no aloja logos). */
  logoUrl: string | null;
  /** Página oficial del centro, asignada en /admin/centros. */
  website: string | null;
}

export interface CenterLine {
  id: number;
  code: string | null;
  name: string;
}

/** Acto administrativo del centro (p. ej. resolución de reconocimiento). El PDF se sirve aparte. */
export interface CenterResolution {
  id: number;
  number: string | null;
  type: string | null;
  /** AAAA-MM-DD. */
  date: string | null;
  description: string | null;
  hasFile: boolean;
}

export interface CenterDetail extends Center {
  lines: CenterLine[];
  resolutions: CenterResolution[];
}

export interface CenterRepository {
  list(signal?: AbortSignal): Promise<Center[]>;
  /** null si no existe. */
  getById(id: number, signal?: AbortSignal): Promise<CenterDetail | null>;
}

export function summarizeCenter({ lines: _l, resolutions: _r, ...c }: CenterDetail): Center {
  return c;
}

/** Ruta del BFF que entrega el PDF de una resolución. */
export const resolutionFileUrl = (centerId: number, resolutionId: number) =>
  `/api/centers/${centerId}/resolutions/${resolutionId}`;

/** Por código institucional (CI-1, CI-2… CI-10), como el registro oficial. */
export const sortCenters = (centers: Center[]) =>
  [...centers].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));

export interface CenterFilters {
  search: string;
  /** Código DANE de la sede. */
  campus: string | null;
  ods: number | null;
}

/** Filtros del catálogo (búsqueda sin tildes por nombre, sigla, código, director o sede). */
export function filterCenters(centers: Center[], f: CenterFilters): Center[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(f.search.trim());
  return centers.filter(
    (c) =>
      (!f.campus || c.daneCode === f.campus) &&
      (!f.ods || c.ods.includes(f.ods as never)) &&
      (!q ||
        [c.name, c.acronym ?? '', c.code, c.director?.name ?? '', c.city ?? ''].some((s) =>
          norm(s).includes(q),
        )),
  );
}
