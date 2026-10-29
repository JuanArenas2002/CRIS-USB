import { summarizeGroup, type GroupDetail, type GroupRepository } from '@/domain/groups/group';
import { groupQueries } from '@/application/groups/group-queries';
import { centerQueries } from '@/application/centers/center-queries';
import { publicationQueries } from '@/application/publications/publication-queries';
import { projectQueries } from '@/application/projects/project-queries';
import { relationQueries } from '@/application/relations/relation-queries';
import type { CollaborationMap, RelationsRepository } from '@/domain/relations/relations';
import type { Project, ProjectRepository } from '@/domain/projects/project';
import {
  publicationStats,
  queryPublications,
  type PublicationRepository,
  type RankedPublication,
} from '@/domain/publications/publication';
import { summarizeCenter, type CenterDetail, type CenterRepository } from '@/domain/centers/center';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppProviders, AppRoutes, createQueryClient } from '@/app/App';
import { authorQueries } from '@/application/authors/author-queries';
import { authorStats, featuredAuthors, queryAuthors, type AuthorProfile } from '@/domain/authors/author';
import type { AuthorRepository } from '@/domain/authors/author-repository';

export function makeAuthor(over: Partial<AuthorProfile> = {}): AuthorProfile {
  return {
    id: 7,
    name: 'Ana María Pérez',
    category: 'senior',
    degree: 'Doctorado',
    orcid: '0000-0002-1825-0097',
    scopusId: '57190000000',
    cvlacUrl: null,
    scholarUrl: null,
    mainGroup: { id: 1, code: 'COL0000001', name: 'Bioinformática y Salud' },
    groups: [{ id: 1, code: 'COL0000001', name: 'Bioinformática y Salud', category: 'A1', ods: [3, 4] }],
    centers: [
      {
        id: 1,
        code: 'CI-1',
        acronym: 'MACONDOLAB',
        name: 'Centro de Crecimiento Empresarial MACONDOLAB',
        logoUrl: null,
      },
    ],
    metrics: null,
    photoUrl: null,
    ranking: { index: 92.5, rank: 4, centerRank: 1, center: 'MACONDOLAB' },
    tiers: {},
    production: null,
    ...over,
  };
}

/** Repositorio en memoria con la misma lógica de consulta que el BFF. */
export function fakeRepo(
  over: Partial<AuthorRepository> = {},
  authors: AuthorProfile[] = [makeAuthor()],
): AuthorRepository {
  return {
    list: async (q) => queryAuthors(authors, q),
    getById: async (id) => authors.find((a) => a.id === id) ?? null,
    stats: async () => authorStats(authors),
    featured: async () => featuredAuthors(authors),
    ...over,
  };
}

export function makeGroupDetail(over: Partial<GroupDetail> = {}): GroupDetail {
  return {
    id: 1,
    code: 'COL0000001',
    name: 'Bioinformática y Salud',
    active: true,
    type: 'Institucional',
    category: 'A1',
    gruplacUrl: 'https://scienti.minciencias.gov.co/gruplac/jsp/visualiza/visualizagr.jsp?nro=1',
    city: 'BARRANQUILLA',
    department: 'ATLÁNTICO',
    foundedYear: 2005,
    leader: {
      name: 'ANA MARÍA PÉREZ',
      orcid: '0000-0002-1825-0097',
      cvlacUrl: null,
      scholarUrl: null,
      scopusId: null,
    },
    lines: [
      {
        id: 10,
        code: 'LG010',
        name: 'Genómica del Caribe',
        objective: 'Estudiar la diversidad genética regional.',
        achievements: null,
        impact: null,
      },
    ],
    ods: [3, 4],
    categoryHistory: [
      { convocation: 'Convocatoria 781 de 2017', year: 2017, category: 'A' },
      { convocation: 'Convocatoria 833 de 2018', year: 2018, category: 'A1' },
    ],
    ...over,
  };
}

export const fakeGroupRepo = (groups: GroupDetail[] = [makeGroupDetail()]): GroupRepository => ({
  list: async () => groups.map(summarizeGroup),
  getById: async (id) => groups.find((g) => g.id === id) ?? null,
  members: async () => [{ ...makeAuthor(), profilePublished: true }],
});

export function makeCenterDetail(over: Partial<CenterDetail> = {}): CenterDetail {
  return {
    id: 1,
    code: 'CI-1',
    acronym: 'MACONDOLAB',
    name: 'Centro de Crecimiento Empresarial MACONDOLAB',
    active: true,
    createdAt: '2004-08-20',
    foundedYear: 2004,
    city: 'BARRANQUILLA',
    department: 'ATLÁNTICO',
    daneCode: '08001',
    director: {
      name: 'GLORIA MARIA NARANJO AFRICANO',
      orcid: '0000-0001-9610-1604',
      cvlacUrl: null,
      scholarUrl: null,
      scopusId: null,
    },
    ods: [8, 9, 17],
    linesCount: 1,
    logoUrl: null,
    website: null,
    lines: [{ id: 1, code: 'LC001', name: 'Emprendimiento Tecnológico' }],
    resolutions: [
      {
        id: 5,
        number: 'Resolucion 2075 2022',
        type: 'Reconocimiento',
        date: '2022-12-14',
        description: 'Reconocimiento oficial del centro.',
        hasFile: true,
      },
    ],
    ...over,
  };
}

export const fakeCenterRepo = (centers: CenterDetail[] = [makeCenterDetail()]): CenterRepository => ({
  list: async () => centers.map(summarizeCenter),
  getById: async (id) => centers.find((c) => c.id === id) ?? null,
});

export function makePublication(over: Partial<RankedPublication> = {}): RankedPublication {
  return {
    rank: 1,
    score: 89.9,
    eid: '2-s2.0-85132899267',
    doi: '10.3390/pharmaceutics14061303',
    title: 'Metabolic Reprogramming in Cancer Cells',
    abstract:
      'The constant changes in cancer cell bioenergetics are widely known as metabolic reprogramming.',
    year: 2022,
    type: 'Review',
    journal: 'Pharmaceutics',
    issn: ['1999-4923'],
    language: 'eng',
    quartile: 'Q1',
    areas: ['Life Sciences and Medicine'],
    citations: 133,
    openAccess: true,
    international: true,
    countries: ['Colombia', 'Venezuela'],
    correspondence: true,
    authorsCount: 9,
    authors: [{ id: 7, name: 'Ana María Pérez', published: true }],
    ...over,
  };
}

export const fakePublicationRepo = (
  all: RankedPublication[] = [makePublication()],
): PublicationRepository => ({
  list: async (q) => queryPublications(all, q),
  stats: async () => publicationStats(all),
});

export function makeProject(over: Partial<Project> = {}): Project {
  return {
    id: 3,
    code: '1-3-02-7-24',
    title: 'Programa de fortalecimiento a organizaciones de cuidado comunitario',
    centers: ['Centro de Investigación e Innovación Social José Consuegra Higgins'],
    groups: ['Educación, ciencias sociales y humanas'],
    area: 'Ciencias Sociales',
    year: 2024,
    startYear: 2024,
    endYear: 2025,
    status: 'En ejecución',
    funder: 'ONU Mujeres',
    allies: null,
    resources: '$1.126.642.650',
    territory: 'Nacional',
    problem: 'Limitado reconocimiento de las organizaciones de cuidado comunitario.',
    solution: null,
    objective: 'Diseñar e implementar un programa de fortalecimiento.',
    results: null,
    beneficiaries: null,
    evidence: 'Sitio: https://cuidaconmigo.com/x',
    ods: [5],
    team: [],
    photoUrl: null,
    gallery: [],
    products: [
      {
        title: 'Plataforma Cuida Conmigo',
        type: 'Desarrollo de Software',
        subtype: 'Plataforma Web',
        year: 2025,
        status: 'Publicado',
        url: 'https://cuidaconmigo.com/',
      },
    ],
    ...over,
  };
}

export const fakeProjectRepo = (projects: Project[] = [makeProject()]): ProjectRepository => ({
  list: async () => projects,
  getById: async (id) => projects.find((p) => p.id === id) ?? null,
});

export const fakeRelationsRepo = (
  map: Omit<CollaborationMap, 'year'> = {
    countries: [
      {
        iso2: 'CO',
        iso3: 'COL',
        isoNumeric: '170',
        country: 'Colombia',
        local: true,
        publications: 1352,
        citations: 14354,
      },
      {
        iso2: 'ES',
        iso3: 'ESP',
        isoNumeric: '724',
        country: 'Spain',
        local: false,
        publications: 341,
        citations: 5000,
      },
    ],
  },
): RelationsRepository => ({
  countries: async (year) => ({ year, ...map }),
  publications: async (iso3) =>
    iso3 === 'ESP'
      ? [
          {
            eid: '2-s2.0-85183412613',
            title: 'Sporting Mind: The Interplay of Physical Activity and Psychological Health',
            year: 2024,
            doi: '10.3390/sports12010037',
            journal: 'Sports',
            docType: 'Review',
            citations: 307,
            quartile: 'Q1',
            partners: ['Universidad Europea de Madrid'],
          },
        ]
      : [],
});

export function renderApp(
  url: string,
  repo: AuthorRepository = fakeRepo(),
  groupRepo = fakeGroupRepo(),
  centerRepo = fakeCenterRepo(),
  publicationRepo = fakePublicationRepo(),
  projectRepo = fakeProjectRepo(),
  relationsRepo = fakeRelationsRepo(),
) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  return render(
    <AppProviders
      queryClient={queryClient}
      queries={authorQueries(repo)}
      groups={groupQueries(groupRepo)}
      centers={centerQueries(centerRepo)}
      publications={publicationQueries(publicationRepo)}
      projects={projectQueries(projectRepo)}
      relations={relationQueries(relationsRepo)}
    >
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}
