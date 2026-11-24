// Perfil de investigador: cálculos puros (sin React) que antes vivían dentro del componente.
import type { TFunction } from 'i18next';
import {
  authorSlug,
  type AuthorProduction,
  type AuthorProfile,
  type ExternalProfile,
  type GroupRef,
} from '@/domain/authors/author';
import { hasPublicDetail } from '@/domain/groups/group';
import { centerPath } from '@/presentation/components/centers/CenterCard';
import { ORGANIZATION, absoluteUrl } from '@/shared/seo';

export type ProfileTab = 'perfil' | 'produccion';

/** El grupo principal primero (con los datos completos del listado de grupos si están); luego el resto, sin repetir. */
export function orderedGroups({
  mainGroup,
  groups,
}: Pick<AuthorProfile, 'mainGroup' | 'groups'>): GroupRef[] {
  return [
    ...(mainGroup ? [groups.find((g) => g.id === mainGroup.id) ?? mainGroup] : []),
    ...groups.filter((g) => g.id !== mainGroup?.id),
  ];
}

export const totalCitations = (production: AuthorProduction | null) =>
  (production?.publications ?? []).reduce((sum, p) => sum + p.citedBy, 0);

/** Descripción para buscadores y redes: categoría, grupo principal y métricas, si existen. */
export function profileDescription(
  t: TFunction<readonly ['authors', 'common']>,
  name: string,
  categoryLabel: string,
  { mainGroup, metrics }: Pick<AuthorProfile, 'mainGroup' | 'metrics'>,
) {
  const base = t('profile.metaBase', { name, category: categoryLabel.toLowerCase() });
  const group = mainGroup ? t('profile.metaGroup', { group: mainGroup.name }) : '';
  const stats = metrics
    ? t('profile.metaMetrics', { publications: metrics.scopusPublications, hIndex: metrics.hIndex ?? '—' })
    : '';
  return `${base}${group}${stats}.`;
}

/** Solo propiedades respaldadas por la fuente: nombre, afiliación, grupos e identificadores. */
export function profileJsonLd(
  author: AuthorProfile,
  name: string,
  path: string,
  groups: GroupRef[],
  profiles: ExternalProfile[],
) {
  const centers = author.centers ?? [];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: absoluteUrl(path),
      mainEntity: {
        '@type': 'Person',
        name,
        affiliation: ORGANIZATION,
        ...(author.photoUrl ? { image: absoluteUrl(author.photoUrl) } : {}),
        ...(groups.length || centers.length
          ? {
              memberOf: [
                ...groups.map((g) => ({
                  '@type': 'Organization',
                  name: g.name,
                  identifier: g.code,
                  ...(hasPublicDetail(g) ? { url: absoluteUrl(`/grupos/${authorSlug(g)}`) } : {}),
                })),
                ...centers.map((c) => ({
                  '@type': 'ResearchOrganization',
                  name: c.name,
                  identifier: c.code,
                  url: absoluteUrl(centerPath(c)),
                })),
              ],
            }
          : {}),
        ...(author.orcid
          ? { identifier: { '@type': 'PropertyValue', propertyID: 'ORCID', value: author.orcid } }
          : {}),
        ...(profiles.length ? { sameAs: profiles.map((p) => p.url) } : {}),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Investigadores', item: absoluteUrl('/investigadores') },
        { '@type': 'ListItem', position: 2, name, item: absoluteUrl(path) },
      ],
    },
  ];
}
