import { summarizeGroup, type GroupDetail, type GroupRepository } from '@/domain/groups/group';
import { groupQueries } from '@/application/groups/group-queries';
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
    metrics: null,
    photoUrl: null,
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

export function renderApp(url: string, repo: AuthorRepository = fakeRepo(), groupRepo = fakeGroupRepo()) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { ...queryClient.getDefaultOptions().queries, retry: false } });
  return render(
    <AppProviders queryClient={queryClient} queries={authorQueries(repo)} groups={groupQueries(groupRepo)}>
      <MemoryRouter initialEntries={[url]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}
