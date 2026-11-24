// Ficha de grupo: cálculos puros (sin React).
import type { TFunction } from 'i18next';
import {
  AUTHOR_CATEGORIES,
  displayName,
  mergeProducts,
  toProducts,
  type AuthorProfile,
  type Product,
} from '@/domain/authors/author';
import type { GroupDetail, GroupMember } from '@/domain/groups/group';
import { ORGANIZATION, absoluteUrl } from '@/shared/seo';

type GroupT = TFunction<readonly ['groups', 'common', 'authors']>;

export type GroupTab = 'perfil' | 'integrantes' | 'produccion';
export const GROUP_TABS: GroupTab[] = ['perfil', 'integrantes', 'produccion'];

/** Texto sin tildes ni mayúsculas, para comparar nombres. */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** El integrante es el líder del grupo (se compara el nombre, sin tildes ni mayúsculas). */
export const isGroupLeader = (member: Pick<GroupMember, 'name'>, leader: GroupDetail['leader']) =>
  Boolean(leader) && fold(member.name) === fold(leader!.name);

/** Descripción para buscadores: nombre y código, categoría y hasta 3 líneas de investigación. */
export function groupDescription(
  t: GroupT,
  group: Pick<GroupDetail, 'name' | 'code' | 'category'>,
  lineNames: string[],
) {
  const base = t('detail.metaBase', { name: group.name, code: group.code });
  const category = group.category ? t('detail.metaCategory', { category: group.category }) : '';
  const lines = lineNames.length ? t('detail.metaLines', { lines: lineNames.slice(0, 3).join(', ') }) : '';
  return `${base}${category}${lines}.`;
}

export function groupJsonLd(group: GroupDetail, path: string, lineNames: string[]) {
  const leader = group.leader;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: group.name,
      identifier: group.code,
      url: absoluteUrl(path),
      parentOrganization: ORGANIZATION,
      ...(group.foundedYear ? { foundingDate: String(group.foundedYear) } : {}),
      ...(group.gruplacUrl ? { sameAs: group.gruplacUrl } : {}),
      ...(lineNames.length ? { knowsAbout: lineNames } : {}),
      ...(leader ? { member: { '@type': 'Person', name: displayName(leader.name), roleName: 'Líder' } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Grupos', item: absoluteUrl('/grupos') },
        { '@type': 'ListItem', position: 2, name: group.name, item: absoluteUrl(path) },
      ],
    },
  ];
}

/** Año de fundación con su antigüedad («2005 · 21 años»); «—» si no se conoce. */
export function foundedYearLabel(t: GroupT, foundedYear: number | null | undefined, years: number | null) {
  if (!foundedYear) return '—';
  return years ? t('detail.age', { year: foundedYear, count: years }) : foundedYear;
}

/** «Ciudad, Departamento» con lo que haya; «—» si no hay nada. */
export const campusLabel = (city: string | null | undefined, department: string | null | undefined) =>
  [city ? displayName(city) : null, department && displayName(department)].filter(Boolean).join(', ') || '—';

/**
 * Producción del grupo: la de los integrantes con perfil publicado, sin repetidos. Sin la línea
 * «Scopus · Artículo» bajo el subtipo: en el grupo no aporta.
 */
export function mergeGroupProducts(
  profiles: ({ kind: string; author?: AuthorProfile } | null | undefined)[],
): Product[] {
  return mergeProducts(
    profiles.map((d) => (d?.kind === 'found' && d.author?.production ? toProducts(d.author.production) : [])),
  ).map((p) => ({ ...p, index: null }));
}

export const countArticles = (products: Product[]) =>
  products.filter((p) => p.type === 'Artículo científico').length;

/**
 * Orden de los integrantes: el líder primero, luego por categoría Minciencias (de mayor a menor) y los sin
 * categoría al final; a igual rango, por nombre.
 */
export function sortMembers(
  members: GroupMember[],
  leader: GroupDetail['leader'],
  locale: string | undefined,
): GroupMember[] {
  const rank = (m: GroupMember) =>
    isGroupLeader(m, leader)
      ? -1
      : AUTHOR_CATEGORIES.findIndex((c) => c.id === m.category) + 1 || AUTHOR_CATEGORIES.length + 1;
  return [...members].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, locale));
}

/** Búsqueda por nombre o por categoría (en el idioma activo), sin tildes ni mayúsculas. */
export function filterMembers(
  members: GroupMember[],
  term: string,
  categoryLabel: (id: NonNullable<GroupMember['category']>) => string,
): GroupMember[] {
  const q = fold(term);
  if (!q) return members;
  return members.filter(
    (m) => fold(m.name).includes(q) || (m.category && fold(categoryLabel(m.category)).includes(q)),
  );
}
