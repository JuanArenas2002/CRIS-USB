import { makeProject } from '@/test-utils';
import {
  TEAM_PREVIEW,
  findByName,
  projectDescription,
  projectJsonLd,
  projectPeriod,
  proseTexts,
  splitUrls,
} from './project-model';

const t = ((key: string) => key) as never;

test('periodo: un año, un rango o «—»', () => {
  expect(projectPeriod({ startYear: null, endYear: 2025 })).toBe('—');
  expect(projectPeriod({ startYear: 2024, endYear: null })).toBe('2024');
  expect(projectPeriod({ startYear: 2024, endYear: 2024 })).toBe('2024');
  expect(projectPeriod({ startYear: 2024, endYear: 2025 })).toBe('2024 – 2025');
  expect(TEAM_PREVIEW).toBe(6);
});

test('descripción: frase base más el objetivo, a lo sumo 300 caracteres', () => {
  expect(projectDescription(t, null)).toBe('detail.metaBase');
  expect(projectDescription(t, 'Objetivo')).toBe('detail.metaBase: Objetivo');
  expect(projectDescription(t, 'x'.repeat(500))).toHaveLength(300);
});

test('grupos y centros por nombre: coinciden sin tildes ni mayúsculas', () => {
  const list = [{ name: 'Educación, Ciencias Sociales' }, { name: 'Otro' }];
  expect(findByName(list, 'educacion ciencias SOCIALES')).toBe(list[0]);
  expect(findByName(list, 'No existe')).toBeUndefined();
  expect(findByName([], 'x')).toBeUndefined();
});

test('textos libres: URLs en posiciones impares; los cinco textos traducibles en orden fijo', () => {
  expect(splitUrls('Sitio: https://a.co/x y http://b.co | fin')).toEqual([
    'Sitio: ',
    'https://a.co/x',
    ' y ',
    'http://b.co',
    ' | fin',
  ]);
  expect(splitUrls('sin enlaces')).toEqual(['sin enlaces']);
  const p = makeProject({ objective: 'O', problem: null, solution: 'S', beneficiaries: null, results: 'R' });
  expect(proseTexts(p)).toEqual(['O', '', 'S', '', 'R']);
});

test('JSON-LD del proyecto: financiador, área y descripción solo si existen', () => {
  const bare = makeProject({ objective: null, funder: null as never, area: null as never });
  const [pr] = projectJsonLd(bare, '/proyectos/3-x', t) as unknown as [Record<string, unknown>];
  for (const k of ['description', 'funder', 'knowsAbout']) expect(pr).not.toHaveProperty(k);
  const [full, crumbs] = projectJsonLd(makeProject(), '/proyectos/3-x', t) as unknown as [
    Record<string, unknown>,
    { itemListElement: unknown[] },
  ];
  expect(full).toMatchObject({
    '@type': 'ResearchProject',
    funder: { name: 'ONU Mujeres' },
    knowsAbout: 'Ciencias Sociales',
  });
  expect(crumbs.itemListElement).toHaveLength(2);
});
