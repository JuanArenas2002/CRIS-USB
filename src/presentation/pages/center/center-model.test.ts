import { makeCenterDetail } from '@/test-utils';
import { centerDescription, centerJsonLd, centerTitle, createdAtLabel } from './center-model';

const t = ((key: string, o?: Record<string, unknown>) =>
  o ? `${key}:${Object.values(o).join('|')}` : key) as never;

test('título y descripción: sigla opcional y hasta 3 líneas', () => {
  expect(centerTitle({ acronym: 'CU', name: 'Centro Uno' })).toBe('CU · Centro Uno');
  expect(centerTitle({ acronym: null, name: 'Centro Uno' })).toBe('Centro Uno');
  expect(centerDescription(t, 'Centro Uno', [])).toBe('detail.metaBase:Centro Uno.');
  expect(centerDescription(t, 'Centro Uno', ['a', 'b', 'c', 'd'])).toBe(
    'detail.metaBase:Centro Uno' + 'detail.metaLines:a, b, c' + '.',
  );
});

test('fecha de creación: con antigüedad solo si hay años; sin fecha, «—»', () => {
  const fmt = (iso: string) => `[${iso}]`;
  expect(createdAtLabel(t, fmt, null, 22)).toBe('—');
  expect(createdAtLabel(t, fmt, '2026-01-01', 0)).toBe('[2026-01-01]');
  expect(createdAtLabel(t, fmt, '2004-08-20', 22)).toBe('detail.age:[2004-08-20]|22');
});

test('JSON-LD del centro: solo propiedades respaldadas por la fuente', () => {
  const bare = makeCenterDetail({
    acronym: null,
    website: null,
    logoUrl: null,
    createdAt: null as never,
    city: null,
    director: null as never,
  });
  const [org] = centerJsonLd(bare, t, []) as unknown as [Record<string, unknown>];
  for (const k of ['alternateName', 'sameAs', 'logo', 'foundingDate', 'location', 'knowsAbout', 'employee'])
    expect(org).not.toHaveProperty(k);

  const [full, crumbs] = centerJsonLd(
    makeCenterDetail({ website: 'https://cu.co/', logoUrl: '/logo.webp' }),
    t,
    ['Línea'],
  ) as unknown as [Record<string, unknown>, { itemListElement: { name: string }[] }];
  expect(full).toMatchObject({
    alternateName: 'MACONDOLAB',
    sameAs: 'https://cu.co/',
    knowsAbout: ['Línea'],
    employee: { '@type': 'Person' },
  });
  expect(crumbs.itemListElement).toHaveLength(2);
});
