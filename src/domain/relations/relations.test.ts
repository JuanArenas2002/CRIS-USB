import { countByYear } from './relations';

test('countByYear: artículos y reviews son NC, el resto DC; internacional si hay países externos', () => {
  const p = (type: string | null, countries: string[], year: number | null = 2024) => ({
    year,
    type,
    countries,
  });
  expect(
    countByYear([
      p('ARTICLE', ['Spain']),
      p('REVIEW', []),
      p('CONFERENCE PAPER', ['Chile', 'Peru']),
      p(null, []),
      p('ARTICLE', ['Spain'], null), // sin año: no cuenta
      p('ARTICLE', [], 2023),
    ]),
  ).toEqual([
    { year: 2023, nc: 1, dc: 0, intlNc: 0, intlDc: 0 },
    { year: 2024, nc: 2, dc: 2, intlNc: 1, intlDc: 1 },
  ]);
});
