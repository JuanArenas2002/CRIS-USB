import {
  authorSlug,
  authorStats,
  displayName,
  externalProfiles,
  featuredAuthors,
  groupByCenter,
  withRankingCenter,
  initials,
  mergeProducts,
  parseAuthorId,
  parseCategory,
  queryAuthors,
  slugify,
  toProducts,
} from './author';
import { isIndexable } from '@/application/authors/author-queries';
import { inheritOds } from '@/domain/ods/ods';
import { productionByYear, yTicks } from '@/presentation/components/authors/ProductionByYear';
import { makeAuthor } from '@/test-utils';

test('slug legible y reversible al id', () => {
  expect(slugify('  José Ñúñez-Ávila ')).toBe('jose-nunez-avila');
  expect(authorSlug({ id: 12, name: 'Gustavo Aroca Martínez' })).toBe('12-gustavo-aroca-martinez');
  expect(authorSlug({ id: 12, name: '—' })).toBe('12');
  expect(parseAuthorId('12-gustavo')).toBe(12);
  expect(parseAuthorId('12')).toBe(12);
  expect(parseAuthorId('gustavo-12')).toBeNull();
  expect(parseAuthorId('0-x')).toBeNull();
  expect(parseAuthorId(undefined)).toBeNull();
});

test('nombre para mostrar: solo normaliza los que vienen en mayúsculas', () => {
  expect(displayName('AROCA MARTÍNEZ G.')).toBe('Aroca Martínez G.');
  expect(displayName('RODRÍGUEZ M.E.')).toBe('Rodríguez M.E.');
  expect(displayName('MARIA DE LA HOZ-PÉREZ')).toBe('Maria de la Hoz-Pérez');
  expect(displayName('Ana de Ávila')).toBe('Ana de Ávila');
});

test('iniciales', () => {
  expect(initials('Ana María Pérez')).toBe('AP');
  expect(initials('Cher')).toBe('C');
});

test('categoría Minciencias desde el texto de Metri-K', () => {
  expect(parseCategory('Sénior (IS)')).toBe('senior');
  expect(parseCategory('Emérito (IE)')).toBe('emerito');
  expect(parseCategory('Asociado (I)')).toBe('asociado');
  expect(parseCategory('Junior (IJ)')).toBe('junior');
  expect(parseCategory('Sin Categoría')).toBeNull();
  expect(parseCategory(null)).toBeNull();
});

test('perfiles externos solo con identificadores presentes', () => {
  const p = externalProfiles(
    makeAuthor({ scopusId: null, cvlacUrl: 'https://scienti.minciencias.gov.co/cvlac/x' }),
  );
  expect(p.map((x) => x.label)).toEqual(['ORCID', 'CvLAC']);
  expect(isIndexable(makeAuthor({ orcid: null, scopusId: null }))).toBe(false);
});

test('consulta: mayor categoría primero, filtros sin tildes y paginación', () => {
  const all = [
    makeAuthor({ id: 1, name: 'Zoe Junior', category: 'junior' }),
    makeAuthor({
      id: 2,
      name: 'Álvaro Sénior',
      category: 'senior',
      mainGroup: { id: 9, code: 'C9', name: 'G9' },
    }),
    makeAuthor({ id: 3, name: 'Bea Sin Categoría', category: null }),
    makeAuthor({ id: 4, name: 'Carla Emérita', category: 'emerito' }),
  ];
  const names = (q: Parameters<typeof queryAuthors>[1]) => queryAuthors(all, q).items.map((a) => a.id);

  expect(names({ page: 1, pageSize: 10 })).toEqual([4, 2, 1, 3]);
  expect(names({ search: 'alvaro', page: 1, pageSize: 10 })).toEqual([2]);
  expect(names({ category: 'junior', page: 1, pageSize: 10 })).toEqual([1]);
  expect(names({ groupId: 9, page: 1, pageSize: 10 })).toEqual([2]);
  expect(queryAuthors(all, { page: 2, pageSize: 3 })).toMatchObject({ total: 4, page: 2, pages: 2 });
  expect(authorStats(all)).toEqual({
    total: 4,
    byCategory: { emerito: 1, senior: 1, asociado: 0, junior: 1 },
  });
});

test('producción → productos con tipología Minciencias, más recientes primero', () => {
  const products = toProducts({
    publications: [
      {
        id: 1,
        title: 'A',
        year: 2020,
        journal: 'J',
        type: 'Article',
        citedBy: 2,
        doi: '10.1/x',
        url: null,
        authors: 'X',
      },
      {
        id: 2,
        title: 'B',
        year: 2024,
        journal: 'J',
        type: 'Conference paper',
        citedBy: 0,
        doi: null,
        url: null,
        authors: null,
      },
    ],
    theses: [{ id: 3, title: 'T', year: 2022, level: 'Maestria', program: 'P', url: null, authors: 'Y' }],
    developments: [{ id: 4, title: 'D', year: 2023, kind: 'Software', company: 'C' }],
  });
  expect(products.map((p) => [p.key, p.typology, p.type])).toEqual([
    ['p2', 'GNC', 'Ponencia'],
    ['d4', 'DTI', 'Producto tecnológico'],
    ['t3', 'FRH', 'Tesis de maestría'],
    ['p1', 'GNC', 'Artículo científico'],
  ]);
  expect(products[3]!.url).toBe('https://doi.org/10.1/x');
});

test('producción por año: cuenta por tipología e incluye años sin producción', () => {
  const pub = (id: number, year: number | null) => ({
    id,
    title: 'P',
    year,
    journal: null,
    type: 'Article',
    citedBy: 0,
    doi: null,
    url: null,
    authors: null,
  });
  const rows = productionByYear(
    toProducts({
      publications: [pub(1, 2020), pub(2, 2022), pub(3, null)],
      theses: [{ id: 4, title: 'T', year: 2022, level: 'Pregrado', program: null, url: null, authors: null }],
      developments: [],
    }),
  );
  expect(rows.map((r) => [r.year, r.total])).toEqual([
    [2020, 1],
    [2021, 0],
    [2022, 2],
  ]);
  expect(rows[2]!.by).toMatchObject({ GNC: 1, FRH: 1, DTI: 0 });
});

test('eje Y con pasos redondos', () => {
  expect(yTicks(23)).toEqual([0, 10, 20, 30]);
  expect(yTicks(4)).toEqual([0, 1, 2, 3, 4]);
  expect(yTicks(7)).toEqual([0, 2, 4, 6, 8]);
  expect(yTicks(256)).toEqual([0, 100, 200, 300]);
  expect(yTicks(0)).toEqual([0, 1]);
});

test('producción de un grupo: une integrantes sin duplicar coautorías', () => {
  const p = (key: string, title: string, year: number | null) => ({
    key,
    typology: 'GNC' as const,
    type: 'Artículo científico',
    title,
    authors: null,
    year,
    venue: null,
    index: null,
    doi: null,
    url: null,
  });
  const merged = mergeProducts([
    [p('a1', 'Salud y Bienestar', 2021), p('a2', 'Otro', 2024)],
    [p('b1', 'salud y bienestar.', 2021), p('b2', 'Salud y Bienestar', 2019)],
  ]);
  expect(merged.map((x) => x.key)).toEqual(['a2', 'a1', 'b2']);
});

test('ODS heredados: unión de los grupos, sin repetir, con los grupos que aportan cada uno', () => {
  expect(
    inheritOds([
      { name: 'A', ods: [10, 3] },
      { name: 'B', ods: [3, 4] },
      { name: 'C' },
      { name: 'A', ods: [3] },
    ]),
  ).toEqual([
    { id: 3, groups: ['A', 'B'] },
    { id: 4, groups: ['B'] },
    { id: 10, groups: ['A'] },
  ]);
  expect(inheritOds([])).toEqual([]);
});

test('consulta por centro: solo sus investigadores, ordenados por puesto en ese centro', () => {
  const cicv = { id: 5, code: 'CI-5', acronym: 'CICV', name: 'Ciencias de la Vida', logoUrl: null };
  const cief = { id: 6, code: 'CI-6', acronym: 'CIEF', name: 'Estudios Fronterizos', logoUrl: null };
  const ranking = (centerRank: number, center: string) => ({ index: 80, rank: 10, centerRank, center });
  const all = [
    makeAuthor({ id: 1, category: 'emerito', centers: [cicv], ranking: ranking(3, 'CICV') }),
    makeAuthor({ id: 2, category: 'junior', centers: [cicv], ranking: ranking(1, 'CICV') }),
    // Aporta a CICV, pero su puesto es en CIEF: va después de los rankeados en CICV.
    makeAuthor({ id: 3, category: 'senior', centers: [cicv, cief], ranking: ranking(1, 'CIEF') }),
    makeAuthor({ id: 4, centers: [cief], ranking: ranking(2, 'CIEF') }),
  ];
  const ids = queryAuthors(all, { centerId: 5, page: 1, pageSize: 10 }).items.map((a) => a.id);
  expect(ids).toEqual([2, 1, 3]);
});

test('consulta: con ranking, siempre de mayor a menor índice (puesto 1 primero); sin ranking, al final', () => {
  const ranking = (rank: number) => ({ index: 100 - rank, rank, centerRank: null, center: null });
  const all = [
    makeAuthor({ id: 1, category: 'emerito', ranking: ranking(3) }),
    makeAuthor({ id: 2, category: 'junior', ranking: ranking(1) }),
    makeAuthor({ id: 3, category: 'senior', ranking: null }),
    makeAuthor({ id: 4, category: 'junior', ranking: ranking(2) }),
  ];
  expect(queryAuthors(all, { page: 1, pageSize: 10 }).items.map((a) => a.id)).toEqual([2, 4, 1, 3]);
});

test('destacados: mismo orden que el directorio (ranking USB); sin ranking, mayor índice H', () => {
  const metrics = (hIndex: number) => ({ hIndex, scopusPublications: 10, products: 10 });
  const ranking = (rank: number) => ({ index: 100 - rank, rank, centerRank: null, center: null });
  const all = [
    makeAuthor({ id: 1, metrics: metrics(30), ranking: ranking(1) }),
    makeAuthor({ id: 2, metrics: metrics(24), ranking: ranking(4) }),
    makeAuthor({ id: 3, metrics: metrics(10), ranking: ranking(2) }),
    makeAuthor({ id: 4, metrics: metrics(50), ranking: null }),
    makeAuthor({ id: 5, metrics: null, ranking: ranking(3) }),
  ];
  expect(featuredAuthors(all).map((a) => a.id)).toEqual([1, 3, 2, 4]);
});

test('centro del ranking: se suma si Metri-K no lo vincula (sin importar mayúsculas) y ordena el filtro', () => {
  const aud = { id: 4, code: 'CI-4', acronym: 'AudacIA', name: 'AudacIA', logoUrl: null };
  const ranking = (centerRank: number) => ({ index: 90, rank: centerRank, centerRank, center: 'AUDACIA' });
  const all = [
    makeAuthor({ id: 1, centers: [], ranking: ranking(1) }), // sin vínculo en Metri-K
    makeAuthor({ id: 2, centers: [aud], ranking: ranking(2) }),
    makeAuthor({ id: 3, centers: [], ranking: null }),
  ].map((a) => withRankingCenter(a, [aud]));
  expect(all.map((a) => a.centers?.map((c) => c.id))).toEqual([[4], [4], []]);
  expect(queryAuthors(all, { centerId: 4, page: 1, pageSize: 10 }).items.map((a) => a.id)).toEqual([1, 2]);
});

test('secciones por centro: una vez cada uno, en su centro del ranking, por puesto; sin centro al final', () => {
  const a = { id: 1, code: 'CI-1', acronym: 'AUDACIA', name: 'A', logoUrl: null };
  const b = { id: 2, code: 'CI-2', acronym: 'BIO', name: 'B', logoUrl: null };
  const rk = (centerRank: number, center: string) => ({ index: 50, rank: 1, centerRank, center });
  const sections = groupByCenter([
    makeAuthor({ id: 10, centers: [a, b], ranking: rk(2, 'BIO') }),
    makeAuthor({ id: 11, centers: [] }),
    makeAuthor({ id: 12, centers: [b], ranking: rk(1, 'BIO') }),
    makeAuthor({ id: 13, centers: [b, a] }),
  ]);
  expect(sections.map((s) => [s.center?.id ?? null, s.authors.map((x) => x.id)])).toEqual([
    [2, [12, 10, 13]],
    [null, [11]],
  ]);
});
