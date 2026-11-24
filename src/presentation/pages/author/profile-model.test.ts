import { externalProfiles } from '@/domain/authors/author';
import { makeAuthor } from '@/test-utils';
import { orderedGroups, profileJsonLd, totalCitations } from './profile-model';

const g = (id: number, name = `G${id}`, extra = {}) => ({ id, code: `C${id}`, name, ...extra });

test('orderedGroups: el principal primero (con los datos del listado) y sin repetir', () => {
  const listed = g(2, 'Dos', { category: 'A1', ods: [3] });
  const out = orderedGroups({ mainGroup: g(2, 'Dos'), groups: [g(1), listed, g(3)] });
  expect(out.map((x) => x.id)).toEqual([2, 1, 3]);
  expect(out[0]).toBe(listed); // los datos completos del listado, no los del grupo principal
  // Si el grupo principal no está en el listado, se usa tal cual.
  expect(orderedGroups({ mainGroup: g(9), groups: [g(1)] }).map((x) => x.id)).toEqual([9, 1]);
  expect(orderedGroups({ mainGroup: null, groups: [g(1), g(2)] }).map((x) => x.id)).toEqual([1, 2]);
  expect(orderedGroups({ mainGroup: null, groups: [] })).toEqual([]);
});

test('totalCitations: suma las citas de las publicaciones; sin producción, cero', () => {
  expect(totalCitations(null)).toBe(0);
  const base = { theses: [], developments: [] };
  expect(totalCitations({ ...base, publications: [] })).toBe(0);
  const pub = (citedBy: number) => ({
    id: citedBy,
    title: 't',
    year: 2024,
    journal: null,
    type: null,
    citedBy,
    doi: null,
    url: null,
    authors: null,
  });
  expect(totalCitations({ ...base, publications: [pub(5), pub(7)] })).toBe(12);
});

test('profileJsonLd: grupos y centros como memberOf, identificadores solo si existen', () => {
  const author = makeAuthor({
    orcid: null,
    scopusId: null,
    photoUrl: null,
    centers: [],
    mainGroup: null,
    groups: [],
  });
  const [page, crumbs] = profileJsonLd(author, 'Ana', '/investigadores/7-ana', [], []) as unknown as [
    { mainEntity: Record<string, unknown> },
    { itemListElement: { name: string }[] },
  ];
  expect(page.mainEntity).not.toHaveProperty('memberOf');
  expect(page.mainEntity).not.toHaveProperty('identifier');
  expect(page.mainEntity).not.toHaveProperty('sameAs');
  expect(page.mainEntity).not.toHaveProperty('image');
  expect(crumbs.itemListElement.map((i) => i.name)).toEqual(['Investigadores', 'Ana']);

  const rich = makeAuthor();
  const groups = orderedGroups(rich);
  const [full] = profileJsonLd(
    rich,
    'Ana',
    '/investigadores/7-ana',
    groups,
    externalProfiles(rich),
  ) as unknown as [
    { mainEntity: { memberOf: { '@type': string }[]; identifier: { value: string }; sameAs: string[] } },
  ];
  expect(full.mainEntity.memberOf.map((m) => m['@type'])).toEqual(['Organization', 'ResearchOrganization']);
  expect(full.mainEntity.identifier.value).toBe(rich.orcid);
  expect(full.mainEntity.sameAs.length).toBeGreaterThan(0);
});
