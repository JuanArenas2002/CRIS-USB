import { useQuery } from '@tanstack/react-query';
import { newsApi } from '@/infrastructure/news/news-api';

/** Consultas compartidas del panel. Catálogos y dependencias cambian poco: caché de 10 min (QueryClient). */

export const KEYS = {
  catalogs: ['news-admin', 'catalogs'],
  news: ['news-admin', 'news'],
  org: ['news-admin', 'org'],
  users: ['news-admin', 'users'],
  roles: ['news-admin', 'roles'],
  permissions: ['news-admin', 'permissions'],
  audit: ['news-admin', 'audit'],
} as const;

export const useCatalogs = () => useQuery({ queryKey: KEYS.catalogs, queryFn: newsApi.catalogs });

/** Facultades, centros y programas (copia local de Metri-K) para nombrar alcances. */
export function useOrg() {
  const faculties = useQuery({ queryKey: [...KEYS.org, 'faculties'], queryFn: () => newsApi.faculties() });
  const centers = useQuery({ queryKey: [...KEYS.org, 'centers'], queryFn: () => newsApi.centers() });
  const programs = useQuery({ queryKey: [...KEYS.org, 'programs'], queryFn: () => newsApi.programs() });
  const units: Record<string, { id: number; name: string }[]> = {
    faculty: faculties.data ?? [],
    research_center: centers.data ?? [],
    academic_program: programs.data ?? [],
  };
  /** Nombre legible de un alcance (tipo + id). */
  const scopeName = (type: string | null, id: number | null) => {
    if (!type) return 'Institucional';
    const found = units[type]?.find((u) => u.id === id);
    return found ? found.name : `${type} #${id}`;
  };
  return { faculties, centers, programs, units, scopeName };
}
