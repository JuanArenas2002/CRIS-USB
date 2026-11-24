// Ficha de proyecto: cálculos puros (sin React).
import type { TFunction } from 'i18next';
import { slugify } from '@/domain/authors/author';
import type { Project } from '@/domain/projects/project';
import { ORGANIZATION, absoluteUrl } from '@/shared/seo';

type ProjectT = TFunction<readonly ['projects', 'common', 'groups']>;

/** Equipos grandes se pliegan para no descuadrar la columna de grupos y centros. */
export const TEAM_PREVIEW = 6;

/** «2024» o «2024 – 2025»; «—» si no hay año de inicio. */
export function projectPeriod({ startYear, endYear }: Pick<Project, 'startYear' | 'endYear'>) {
  if (!startYear) return '—';
  return `${startYear}${endYear && endYear !== startYear ? ` – ${endYear}` : ''}`;
}

/** Descripción para buscadores: frase base más el objetivo, a lo sumo 300 caracteres. */
export const projectDescription = (t: ProjectT, objective: string | null) =>
  `${t('detail.metaBase')}${objective ? `: ${objective}` : ''}`.slice(0, 300);

export function projectJsonLd(p: Project, path: string, t: ProjectT) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'ResearchProject',
      name: p.title,
      identifier: p.code,
      url: absoluteUrl(path),
      parentOrganization: ORGANIZATION,
      ...(p.objective ? { description: p.objective } : {}),
      ...(p.funder ? { funder: { '@type': 'Organization', name: p.funder } } : {}),
      ...(p.area ? { knowsAbout: p.area } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('metaTitle'), item: absoluteUrl('/proyectos') },
        { '@type': 'ListItem', position: 2, name: p.title, item: absoluteUrl(path) },
      ],
    },
  ];
}

/** Metri-K da los grupos y centros por nombre: se enlazan a su ficha si el nombre coincide (sin tildes ni mayúsculas). */
export const findByName = <T extends { name: string }>(items: T[], name: string): T | undefined =>
  items.find((i) => slugify(i.name) === slugify(name));

/** Parte un texto libre en trozos alternos: texto, URL, texto, URL… (las URLs quedan en las posiciones impares). */
export const splitUrls = (text: string) => text.split(/(https?:\/\/[^\s|]+)/);

/** Los cinco textos libres de Metri-K que se traducen, en orden fijo; los que faltan quedan vacíos. */
export const proseTexts = (
  p: Pick<Project, 'objective' | 'problem' | 'solution' | 'beneficiaries' | 'results'>,
) => [p.objective, p.problem, p.solution, p.beneficiaries, p.results].map((s) => s ?? '');
