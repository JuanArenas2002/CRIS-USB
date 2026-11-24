// Producción científica destacada: cálculos puros de la página (sin React).
import type { TFunction } from 'i18next';
import { scopusProductType, type Product } from '@/domain/authors/author';
import {
  publicationUrl,
  type ListedPublication,
  type PublicationPage,
  type PublicationQuery,
  type PublicationStats,
} from '@/domain/publications/publication';
import { ORGANIZATION, absoluteUrl } from '@/shared/seo';

type PublicationsT = TFunction<readonly ['publications', 'common']>;
type Option = [value: string, label: string];

/**
 * Publicación del ranking → fila de la tabla de productos del investigador. El acceso abierto va en el
 * detalle bajo el tipo y las citas en su columna (el cuartil no se publica); el orden sigue siendo el del ranking.
 */
export function publicationToProduct(p: ListedPublication, openAccessLabel: string): Product {
  return {
    key: p.eid,
    typology: 'GNC',
    type: scopusProductType(p.type),
    title: p.title,
    authors: null,
    year: p.year,
    venue: p.journal,
    index: p.openAccess ? openAccessLabel : null,
    citations: p.citations,
    doi: p.doi,
    url: publicationUrl(p),
  };
}

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

/**
 * Rango de años del filtro como [desde, hasta], aunque venga invertido (se toma al derecho, como la lista);
 * sin extremo, el que falte es abierto.
 */
export function yearRange(filters: Pick<PublicationQuery, 'yearFrom' | 'yearTo'>): [number, number] {
  const [from, to] = [filters.yearFrom ?? 0, filters.yearTo ?? Infinity].sort((a, b) => a - b);
  return [from!, to!];
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
