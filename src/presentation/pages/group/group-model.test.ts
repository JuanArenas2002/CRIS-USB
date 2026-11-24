import type { Product } from '@/domain/authors/author';
import type { GroupMember } from '@/domain/groups/group';
import { makeAuthor, makeGroupDetail } from '@/test-utils';
import {
  campusLabel,
  countArticles,
  filterMembers,
  fold,
  foundedYearLabel,
  groupJsonLd,
  isGroupLeader,
  mergeGroupProducts,
  sortMembers,
} from './group-model';

const member = (id: number, name: string, category: GroupMember['category'] = null): GroupMember =>
  ({ ...makeAuthor({ id, name, category }), profilePublished: true }) as GroupMember;

test('nombres: se comparan sin tildes ni mayúsculas; el líder se reconoce por su nombre', () => {
  expect(fold('  ÁNGEL Pérez ')).toBe('angel perez');
  const leader = { name: 'ANA MARÍA PÉREZ' } as never;
  expect(isGroupLeader({ name: 'Ana María Perez' }, leader)).toBe(true);
  expect(isGroupLeader({ name: 'Otra Persona' }, leader)).toBe(false);
  expect(isGroupLeader({ name: 'Ana María Perez' }, null)).toBe(false);
});

test('año de fundación y sede', () => {
  const t = ((key: string, o?: { year: number; count: number }) => `${key}:${o?.year}:${o?.count}`) as never;
  expect(foundedYearLabel(t, null, null)).toBe('—');
  expect(foundedYearLabel(t, 2026, 0)).toBe(2026); // fundado este año: sin «0 años»
  expect(foundedYearLabel(t, 2005, 21)).toBe('detail.age:2005:21');
  expect(campusLabel('BARRANQUILLA', 'ATLÁNTICO')).toBe('Barranquilla, Atlántico');
  expect(campusLabel(null, 'ATLÁNTICO')).toBe('Atlántico');
  expect(campusLabel(null, null)).toBe('—');
});

test('integrantes: el líder primero, luego por categoría y nombre; la búsqueda ignora tildes y mayúsculas', () => {
  const leader = { name: 'Zoe Líder' } as never;
  const sorted = sortMembers(
    [
      member(1, 'Beto Sin Categoría'),
      member(2, 'Carla Junior', 'junior'),
      member(3, 'Zoe Lider'),
      member(4, 'Ana Sénior', 'senior'),
    ],
    leader,
    'es',
  );
  expect(sorted.map((m) => m.id)).toEqual([3, 4, 2, 1]);

  const label = (id: string) => (id === 'senior' ? 'Investigador Sénior' : 'Investigador Junior');
  expect(filterMembers(sorted, '', label)).toBe(sorted);
  expect(filterMembers(sorted, 'SENIOR', label).map((m) => m.id)).toEqual([4]); // por categoría visible
  expect(filterMembers(sorted, 'carla', label).map((m) => m.id)).toEqual([2]);
  expect(filterMembers(sorted, 'zzz', label)).toEqual([]);
});

test('producción del grupo: une la de los perfiles hallados, sin repetidos y sin la línea del índice', () => {
  const product = (title: string): Product =>
    ({
      key: title,
      typology: 'GNC',
      type: 'Artículo científico',
      title,
      authors: null,
      year: 2024,
      venue: null,
      index: 'Scopus',
      citations: 0,
      doi: null,
      url: null,
    }) as Product;
  const production = (titles: string[]) =>
    ({
      publications: titles.map((title, i) => ({
        id: i,
        title,
        year: 2024,
        journal: null,
        type: 'Article',
        citedBy: 0,
        doi: null,
        url: null,
        authors: null,
      })),
      theses: [],
      developments: [],
    }) as never;
  const found = (titles: string[]) => ({
    kind: 'found',
    author: makeAuthor({ production: production(titles) }),
  });
  const merged = mergeGroupProducts([
    found(['Uno', 'Dos']),
    found(['Dos', 'Tres']),
    { kind: 'not-found' },
    undefined,
    found([]),
  ]);
  expect(merged.map((p) => p.title).sort()).toEqual(['Dos', 'Tres', 'Uno']);
  expect(merged.every((p) => p.index === null)).toBe(true);
  expect(mergeGroupProducts([])).toEqual([]);
  expect(countArticles([product('a'), { ...product('b'), type: 'Tesis' } as Product])).toBe(1);
});

test('JSON-LD del grupo: fundación, GrupLAC, líneas y líder solo si existen', () => {
  const bare = makeGroupDetail({
    foundedYear: null,
    gruplacUrl: null as never,
    leader: null as never,
    lines: [],
  });
  const [org] = groupJsonLd(bare, '/grupos/1-x', []) as unknown as [Record<string, unknown>];
  for (const key of ['foundingDate', 'sameAs', 'knowsAbout', 'member']) expect(org).not.toHaveProperty(key);

  const [full, crumbs] = groupJsonLd(makeGroupDetail(), '/grupos/1-x', ['Línea A']) as unknown as [
    Record<string, unknown>,
    { itemListElement: { name: string }[] },
  ];
  expect(full).toMatchObject({
    foundingDate: '2005',
    knowsAbout: ['Línea A'],
    member: { roleName: 'Líder' },
  });
  expect(crumbs.itemListElement.map((i) => i.name)).toEqual(['Grupos', 'Bioinformática y Salud']);
});
