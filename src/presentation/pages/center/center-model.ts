// Ficha de centro: cálculos puros (sin React).
import type { TFunction } from 'i18next';
import { authorSlug, displayName } from '@/domain/authors/author';
import type { CenterDetail } from '@/domain/centers/center';
import { ORGANIZATION, absoluteUrl } from '@/shared/seo';

type CenterT = TFunction<readonly ['centers', 'common']>;

export const centerTitle = (c: Pick<CenterDetail, 'acronym' | 'name'>) =>
  c.acronym ? `${c.acronym} · ${c.name}` : c.name;

/** Descripción para buscadores: nombre y hasta 3 líneas de investigación. */
export function centerDescription(t: CenterT, name: string, lineNames: string[]) {
  const lines = lineNames.length ? t('detail.metaLines', { lines: lineNames.slice(0, 3).join(', ') }) : '';
  return `${t('detail.metaBase', { name })}${lines}.`;
}

/** Fecha de creación con su antigüedad («20 ago 2004 · 22 años»); «—» si no se conoce. */
export function createdAtLabel(
  t: CenterT,
  formatDate: (iso: string) => string,
  createdAt: string | null | undefined,
  years: number | null,
) {
  if (!createdAt) return '—';
  return years ? t('detail.age', { date: formatDate(createdAt), count: years }) : formatDate(createdAt);
}

export function centerJsonLd(c: CenterDetail, t: CenterT, lineNames: string[]) {
  const path = `/centros/${authorSlug(c)}`;
  const city = c.city ? displayName(c.city) : null;
  const director = c.director;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ResearchOrganization',
      name: c.name,
      ...(c.acronym ? { alternateName: c.acronym } : {}),
      identifier: c.code,
      url: absoluteUrl(path),
      ...(c.website ? { sameAs: c.website } : {}),
      ...(c.logoUrl ? { logo: absoluteUrl(c.logoUrl) } : {}),
      parentOrganization: ORGANIZATION,
      ...(c.createdAt ? { foundingDate: c.createdAt } : {}),
      ...(city ? { location: { '@type': 'Place', name: city } } : {}),
      ...(lineNames.length ? { knowsAbout: lineNames } : {}),
      ...(director
        ? {
            employee: {
              '@type': 'Person',
              name: displayName(director.name),
              jobTitle: t('detail.directorName'),
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('metaTitle'), item: absoluteUrl('/centros') },
        { '@type': 'ListItem', position: 2, name: c.name, item: absoluteUrl(path) },
      ],
    },
  ];
}
