import { expect, test } from 'vitest';
import { tallyByConvocation } from './group';

test('tallyByConvocation: cuenta por convocatoria y categoría, ordenado por año', () => {
  const h = (convocation: string, year: number, category: string) => ({ convocation, year, category });
  expect(
    tallyByConvocation([
      {
        id: 1,
        name: 'Beta',
        categoryHistory: [
          h('Convocatoria 957 de 2024', 2024, 'B'),
          h('Convocatoria 640 de 2013', 2013, 'Reconocido'),
        ],
      },
      { id: 2, name: 'Alfa', categoryHistory: [h('Convocatoria 957 de 2024', 2024, 'a1')] },
    ]),
  ).toEqual([
    {
      convocation: 'Convocatoria 640 de 2013',
      year: 2013,
      counts: { RECONOCIDO: 1 },
      groups: [{ id: 1, name: 'Beta', category: 'RECONOCIDO' }],
    },
    {
      convocation: 'Convocatoria 957 de 2024',
      year: 2024,
      counts: { A1: 1, B: 1 },
      groups: [
        { id: 2, name: 'Alfa', category: 'A1' },
        { id: 1, name: 'Beta', category: 'B' },
      ],
    },
  ]);
});
