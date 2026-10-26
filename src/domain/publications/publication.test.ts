import { makePublication } from '@/test-utils';
import { publicationStats, publicationUrl, queryPublications, withAuthors } from './publication';

const all = [
  makePublication(),
  makePublication({
    rank: 2,
    eid: '2-s2.0-2',
    title: 'Friction stir welding',
    year: 2025,
    type: 'Article',
    quartile: 'Q2',
    citations: 400,
    openAccess: false,
    areas: ['Engineering and Technology'],
    authors: [{ id: 9, name: 'Roosvel Soto-Díaz', published: true }],
  }),
  makePublication({
    rank: 3,
    eid: '2-s2.0-3',
    title: 'Psoriasis',
    year: 2022,
    quartile: null,
    citations: 10,
  }),
];
const q = (over = {}) => ({ page: 1, pageSize: 20, ...over });
const ranks = (r: { items: { rank: number }[] }) => r.items.map((p) => p.rank);

test('queryPublications: filtros combinables, búsqueda sin tildes (incluye autores) y orden', () => {
  expect(ranks(queryPublications(all, q()))).toEqual([1, 2, 3]);
  expect(ranks(queryPublications(all, q({ yearFrom: 2022, yearTo: 2022 })))).toEqual([1, 3]);
  expect(ranks(queryPublications(all, q({ yearFrom: 2023 })))).toEqual([2]);
  expect(ranks(queryPublications(all, q({ yearTo: 2024 })))).toEqual([1, 3]);
  expect(ranks(queryPublications(all, q({ yearFrom: 2025, yearTo: 2020 })))).toEqual([1, 2, 3]); // invertido
  expect(ranks(queryPublications(all, q({ quartile: 'Q1' })))).toEqual([1]);
  expect(ranks(queryPublications(all, q({ type: 'Article' })))).toEqual([2]);
  expect(ranks(queryPublications(all, q({ area: 'Engineering and Technology' })))).toEqual([2]);
  expect(ranks(queryPublications(all, q({ openAccess: true })))).toEqual([1, 3]);
  expect(ranks(queryPublications(all, q({ search: 'SOTO-DIAZ' })))).toEqual([2]);
  expect(ranks(queryPublications(all, q({ sort: 'recent' })))).toEqual([2, 1, 3]);
  expect(ranks(queryPublications(all, q({ sort: 'cited' })))).toEqual([2, 1, 3]);
  expect(queryPublications(all, q({ pageSize: 2, page: 2 }))).toMatchObject({ total: 3, pages: 2, page: 2 });
});

test('queryPublications: el puesto se recalcula entre las filtradas, sin importar el orden', () => {
  const pos = (r: { items: { rank: number; position: number }[] }) =>
    r.items.map((p) => [p.rank, p.position]);
  expect(pos(queryPublications(all, q()))).toEqual([
    [1, 1],
    [2, 2],
    [3, 3],
  ]);
  expect(pos(queryPublications(all, q({ yearTo: 2024 })))).toEqual([
    [1, 1],
    [3, 2],
  ]);
  expect(pos(queryPublications(all, q({ yearTo: 2024, sort: 'cited', pageSize: 1, page: 2 })))).toEqual([
    [3, 2],
  ]);
});

test('publicationStats: totales y opciones de filtro', () => {
  expect(publicationStats(all)).toEqual({
    total: 3,
    byQuartile: { Q1: 1, Q2: 1, Q3: 0, Q4: 0 },
    openAccess: 2,
    international: 3,
    citations: 543,
    years: [2025, 2022],
    types: ['Review', 'Article'],
    areas: ['Life Sciences and Medicine', 'Engineering and Technology'],
  });
});

test('withAuthors: autores por EID; solo activos, con enlace solo si están publicados', () => {
  const [p] = withAuthors(
    [makePublication({ authors: [] })],
    new Map([['2-s2.0-85132899267', [1, 2, 3]]]),
    new Map([
      [1, 'ANA'],
      [2, 'LUIS'],
    ]),
    new Set([1]),
  );
  expect(p!.authors).toEqual([
    { id: 1, name: 'ANA', published: true },
    { id: 2, name: 'LUIS', published: false },
  ]);
});

test('publicationUrl: DOI o, sin DOI, el registro de Scopus', () => {
  expect(publicationUrl({ doi: '10.1/x', eid: '2-s2.0-1' })).toBe('https://doi.org/10.1/x');
  expect(publicationUrl({ doi: null, eid: '2-s2.0-1' })).toBe(
    'https://www.scopus.com/inward/record.uri?eid=2-s2.0-1',
  );
});
