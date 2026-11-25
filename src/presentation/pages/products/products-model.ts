// Producción científica destacada: cálculos puros de la página (sin React).
import type { TFunction } from 'i18next';
import {
  publicationUrl,
  type PublicationPage,
  type PublicationQuery,
  type PublicationStats,
} from '@/domain/publications/publication';
import { ORGANIZATION, absoluteUrl } from '@/shared/seo';

type PublicationsT = TFunction<readonly ['publications', 'common']>;
type Option = [value: string, label: string];

/** Datos estructurados de la lista; solo la página sin filtros es una colección indexable. */
export function collectionJsonLd(name: string, list: PublicationPage | undefined, isFiltered: boolean) {
  if (!list || isFiltered) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: absoluteUrl('/productos'),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: list.total,
      itemListElement: list.items.map((p) => ({
        '@type': 'ListItem',
        position: p.position,
        item: {
          '@type': 'ScholarlyArticle',
          name: p.title,
          url: publicationUrl(p),
          ...(p.year ? { datePublished: String(p.year) } : {}),
          ...(p.journal ? { isPartOf: { '@type': 'Periodical', name: p.journal } } : {}),
          ...(p.doi ? { identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: p.doi } } : {}),
          sourceOrganization: ORGANIZATION,
        },
      })),
    },
  };
}

/** Años con publicaciones, más los del rango elegido (un enlace puede traer uno sin publicaciones); recientes primero. */
export function selectableYears(
  statsYears: number[] | undefined,
  filters: Pick<PublicationQuery, 'yearFrom' | 'yearTo'>,
): number[] {
  return [
    ...new Set([...(statsYears ?? []), filters.yearFrom ?? 0, filters.yearTo ?? 0].filter(Boolean)),
  ].sort((a, b) => b - a);
}

export const toOptions = (all: string[], label: (v: string) => string): Option[] =>
  all.map((v) => [v, label(v)]);

/** «Desde»: solo años que no superan el «hasta» elegido. */
export function yearFromOptions(t: PublicationsT, years: number[], yearTo?: number): Option[] {
  return [
    ['', t('anyYearFrom')],
    ...toOptions(years.filter((y) => !yearTo || y <= yearTo).map(String), (y) => t('fromYear', { year: y })),
  ];
}

/** «Hasta»: solo años que no son menores al «desde» elegido. */
export function yearToOptions(t: PublicationsT, years: number[], yearFrom?: number): Option[] {
  return [
    ['', t('anyYearTo')],
    ...toOptions(years.filter((y) => !yearFrom || y >= yearFrom).map(String), (y) =>
      t('toYear', { year: y }),
    ),
  ];
}

export interface StatCard {
  key: string;
  label: string;
  value: number | undefined;
  accent: string;
}

/** Las cuatro cifras de la cabecera; sin estadísticas aún, el valor queda indefinido («—»). */
export function statCards(t: PublicationsT, s: PublicationStats | undefined): StatCard[] {
  return [
    { key: 'total', label: t('statTotal'), value: s?.total, accent: 'text-surface-container-lowest' },
    { key: 'q1', label: t('statQ1'), value: s?.q1, accent: 'text-secondary-fixed' },
    { key: 'oa', label: t('statOpenAccess'), value: s?.openAccess, accent: 'text-surface-container-lowest' },
    { key: 'cites', label: t('statCitations'), value: s?.citations, accent: 'text-tertiary-fixed' },
  ];
}

const SORT_LABELS = { rank: 'sortRank', recent: 'sortRecent', cited: 'sortCited' } as const;

/** Filtros activos como frases cortas, en el orden de la barra de filtros; el orden por puntaje no cuenta. */
export function activeFilterParts(
  t: PublicationsT,
  f: Pick<PublicationQuery, 'search' | 'yearFrom' | 'yearTo' | 'type' | 'area' | 'openAccess' | 'sort'>,
  domain: (s: string) => string,
): string[] {
  const search = f.search?.trim();
  return [
    search ? t('activeFilters.search', { value: search }) : '',
    f.yearFrom ? t('fromYear', { year: f.yearFrom }) : '',
    f.yearTo ? t('toYear', { year: f.yearTo }) : '',
    f.type ? `${t('type')}: ${domain(f.type)}` : '',
    f.area ? `${t('area')}: ${domain(f.area)}` : '',
    f.openAccess ? t('openAccessOnly') : '',
    f.sort && f.sort !== 'rank' ? t('activeFilters.order', { value: t(SORT_LABELS[f.sort]) }) : '',
  ].filter(Boolean);
}

/** Código ISO 639 de Scopus ("eng", "spa") → nombre del idioma en el idioma activo; desconocido, el código. */
export function languageName(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code);
    return name && name !== code
      ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
      : code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
