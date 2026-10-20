import { rankingRows } from './ranking-admin';

test('rankingRows: columnas por nombre (tildes, espacios y orden indiferentes); sin cédula se omite', () => {
  const table = [
    ['Reporte'],
    [
      'Nombre Completo',
      'CC',
      'Puesto_General',
      'Puesto_Centro',
      'Centro (unificado)',
      'Índice_Productividad',
      'Horas',
    ],
    ['ANA PEREZ', '1.234.567', '1', '2', 'CICV', '98,6', '40'],
    ['SIN CEDULA', '', '2', '1', 'CIEF', '90', '40'],
    ['LUIS', '7654321', '3', '', '', '70.25', ''],
  ];
  expect(rankingRows(table)).toEqual([
    { cc: '1234567', name: 'ANA PEREZ', rank: 1, centerRank: 2, center: 'CICV', index: 98.6 },
    { cc: '7654321', name: 'LUIS', rank: 3, centerRank: null, center: null, index: 70.25 },
  ]);
  expect(() => rankingRows([['CC', 'Nombre Completo']])).toThrow(/Faltan columnas/);
});
