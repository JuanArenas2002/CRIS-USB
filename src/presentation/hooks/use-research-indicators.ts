import { useTranslation } from 'react-i18next';
import { isRunning } from '@/domain/projects/project';
import { internationalPartners } from '@/domain/relations/relations';
import { activeLocale } from '@/i18n';
import { countryName } from '@/presentation/components/relations/Flag';
import { useAuthorStats } from '@/presentation/hooks/use-authors';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useGroups } from '@/presentation/hooks/use-groups';
import { useLabels } from '@/presentation/hooks/use-labels';
import { useProjects } from '@/presentation/hooks/use-projects';
import { usePublicationStats } from '@/presentation/hooks/use-publications';
import { useCollaborationMap } from '@/presentation/hooks/use-relations';
import type { NavItem } from '@/shared/navigation';

export type Indicator =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'empty' }
  | { status: 'ready'; value: number; detail: string; note?: string };

export type ResearchIndicatorMap = Record<NavItem['key'], Indicator>;

interface AreaQuery<T> {
  data: T | undefined;
  isError: boolean;
  refetch: () => unknown;
}

/** Una cantidad desconocida no se muestra como 0, y el fallo de un área no afecta a las demás. */
function toIndicator<T>(
  query: AreaQuery<T>,
  read: (data: T) => { value: number; detail: string; note?: string },
): Indicator {
  if (query.data === undefined)
    return query.isError ? { status: 'error', retry: () => void query.refetch() } : { status: 'loading' };
  const reading = read(query.data);
  return reading.value > 0 ? { status: 'ready', ...reading } : { status: 'empty' };
}

/**
 * Cifras de la portada por área, con las mismas consultas (y caché) de cada módulo: así coinciden
 * con lo que publica su página. El BFF solo da totales de investigadores y publicaciones; los demás
 * módulos entregan su lista publicada, sin endpoint de conteo.
 */
export function useResearchIndicators(): ResearchIndicatorMap {
  const { t } = useTranslation('home');
  const { number } = useLabels();
  const centers = useCenters();
  const groups = useGroups();
  const authors = useAuthorStats();
  const projects = useProjects();
  const products = usePublicationStats();
  const relations = useCollaborationMap(null);

  const line = (count: string, extra?: string) => (extra ? `${count} · ${extra}` : count);
  const extra = (value: number, text: (value: string) => string) =>
    value > 0 ? text(number(value)) : undefined;
  const centerCount = centers.data?.length;

  return {
    centers: toIndicator(centers, (list) => ({
      value: list.length,
      detail: t('areas.centers.count', { count: list.length, value: number(list.length) }),
    })),
    groups: toIndicator(groups, (list) => ({
      value: list.length,
      detail: line(
        t('areas.groups.count', { count: list.length, value: number(list.length) }),
        extra(list.filter((g) => g.category === 'A1').length, (value) => t('areas.groups.extra', { value })),
      ),
      note: centerCount
        ? t('indicators.groupsNote', { count: centerCount, value: number(centerCount) })
        : undefined,
    })),
    authors: toIndicator(authors, ({ total, byCategory }) => ({
      value: total,
      detail: line(
        t('areas.authors.count', { count: total, value: number(total) }),
        extra(byCategory.senior + byCategory.emerito, (value) => t('areas.authors.extra', { value })),
      ),
    })),
    projects: toIndicator(projects, (list) => {
      const note = extra(list.filter(isRunning).length, (value) => t('areas.projects.extra', { value }));
      return {
        value: list.length,
        detail: line(t('areas.projects.count', { count: list.length, value: number(list.length) }), note),
        note,
      };
    }),
    products: toIndicator(products, ({ total, citations }) => {
      const note = extra(citations, (value) => t('areas.products.extra', { value }));
      return {
        value: total,
        detail: line(t('areas.products.count', { count: total, value: number(total) }), note),
        note,
      };
    }),
    relations: toIndicator(relations, ({ countries }) => {
      const partners = internationalPartners(countries);
      const top = partners[0];
      const note =
        top && t('areas.relations.extra', { country: countryName(top.iso2, top.country, activeLocale()) });
      return {
        value: partners.length,
        detail: line(
          t('areas.relations.count', { count: partners.length, value: number(partners.length) }),
          note,
        ),
        note,
      };
    }),
  };
}
