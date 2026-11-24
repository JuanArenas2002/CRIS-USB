import { publicationRows } from './publication-admin';

test('publicationRows: columnas por nombre (tildes y signos indiferentes); sin EID se omite', () => {
  const table = [
    [
      '#',
      'Puntaje',
      'EID',
      'DOI',
      'Título',
      'Abstract',
      'Año',
      'Tipo documental',
      'Revista',
      'ISSN',
      'Idioma',
      'Cuartil',
      'Año de la métrica',
      'Gran área 1',
      'Gran área 2',
      'Citas',
      'Citas por año',
      'Open Access',
      'Coautoría internacional',
      'Países de afiliación',
      'Correspondencia institucional',
      '# Autores',
      'Aporte cuartil',
    ],
    [
      '1',
      '89.9',
      '2-s2.0-85132899267',
      '10.3390/pharmaceutics14061303',
      'Metabolic Reprogramming',
      'The constant changes…',
      '2022',
      'Review',
      'Pharmaceutics',
      '14220067 1661659X',
      'eng',
      'Q1',
      '2021',
      'Life Sciences and Medicine',
      '',
      '133',
      '33.25',
      'SI',
      'SI',
      'Colombia | Czech Republic | Venezuela',
      'SI',
      '9',
      '30',
    ],
    [
      '2',
      '50',
      '',
      '',
      'Sin EID',
      '',
      '2020',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '0',
      '0',
      'NO',
      'NO',
      '',
      'NO',
      '1',
      '0',
    ],
    [
      '3',
      '40,5',
      '2-s2.0-1000000',
      '',
      'Otra',
      '',
      '2019',
      'Article',
      'X',
      '',
      '',
      '-',
      '',
      'A',
      'B',
      '2',
      '1',
      'NO',
      'NO',
      'Colombia',
      'NO',
      '',
      '0',
    ],
  ];
  expect(publicationRows(table)).toEqual([
    {
      rank: 1,
      score: 89.9,
      eid: '2-s2.0-85132899267',
      doi: '10.3390/pharmaceutics14061303',
      title: 'Metabolic Reprogramming',
      abstract: 'The constant changes…',
      year: 2022,
      type: 'Review',
      journal: 'Pharmaceutics',
      issn: ['1422-0067', '1661-659X'],
      language: 'eng',
      quartile: 'Q1',
      areas: ['Life Sciences and Medicine'],
      citations: 133,
      openAccess: true,
      international: true,
      countries: ['Colombia', 'Czech Republic', 'Venezuela'],
      correspondence: true,
      authorsCount: 9,
    },
    {
      rank: 3,
      score: 40.5,
      eid: '2-s2.0-1000000',
      doi: null,
      title: 'Otra',
      abstract: null,
      year: 2019,
      type: 'Article',
      journal: 'X',
      issn: [],
      language: null,
      quartile: null,
      areas: ['A', 'B'],
      citations: 2,
      openAccess: false,
      international: false,
      countries: ['Colombia'],
      correspondence: false,
      authorsCount: null,
    },
  ]);
  expect(() => publicationRows([['EID', 'Título']])).toThrow(/Faltan columnas en la hoja: puntaje/);
  expect(() => publicationRows([['Título']])).toThrow(/EID/);
});

test('publicationRows: el orden de las columnas no importa y, si una cabecera se repite, vale la primera', () => {
  const a = [
    ['#', 'EID', 'Título', 'Puntaje', 'Citas', 'Revista'],
    ['7', '2-s2.0-1', 'Uno', '10', '5', 'J1'],
  ];
  const b = [
    ['Revista', 'Citas', 'Puntaje', 'Título', 'EID', '#'],
    ['J1', '5', '10', 'Uno', '2-s2.0-1', '7'],
  ];
  expect(publicationRows(b)).toEqual(publicationRows(a));
  expect(publicationRows(a)[0]).toMatchObject({
    rank: 7,
    eid: '2-s2.0-1',
    title: 'Uno',
    citations: 5,
    journal: 'J1',
  });

  // «Citas» y «EID» repetidos más a la derecha no pisan a los primeros.
  const dup = [
    ['EID', 'Título', 'Puntaje', 'Citas', 'EID', 'Citas'],
    ['2-s2.0-1', 'Uno', '10', '5', '2-s2.0-OTRO', '99'],
  ];
  expect(publicationRows(dup)[0]).toMatchObject({ eid: '2-s2.0-1', citations: 5 });
});

test('publicationRows: una columna opcional ausente deja su valor vacío; sin «#», el orden de las filas es el puesto', () => {
  const [first, second] = publicationRows([
    ['EID', 'Título', 'Puntaje'],
    ['2-s2.0-1', 'Uno', '10'],
    ['2-s2.0-2', 'Dos', ''],
  ]);
  expect(first).toMatchObject({
    rank: 1,
    doi: null,
    year: null,
    areas: [],
    countries: [],
    authorsCount: null,
  });
  expect(second).toMatchObject({ rank: 2, score: 0, quartile: null, openAccess: false });
});
