// @vitest-environment node
import { cleanText, toCategoryRecord, toPublicGroup, toPublicLine } from './groups-source';

// Forma real de un elemento de GET /back/api/group (valores ficticios).
const raw = {
  id: 14,
  code: 'COL0016962',
  name: 'Derechos humanos',
  state: true,
  url: 'https://scienti.minciencias.gov.co/gruplac/jsp/visualiza/visualizagr.jsp?nro=1',
  date_created: '2000-11-01T00:00:00.000Z',
  type: 'Institucional',
  lastCategory: 'a1',
  mentor: {
    person: { documentNumber: '99999999', email: 'm@x.co', gender: 'F' },
    user: { username: 'mentor', password: '$2b$10$hash' },
  },
  leader: {
    person: { documentNumber: '11111111', phone: '3000000000', ethnicity: 'X', email: 'l@x.co' },
    name_standard: 'PEREZ LARA, ANA MARIA',
    cvlac: 'https://scienti.minciencias.gov.co/cvlac/visualizador/generarCurriculoCv.do?cod_rh=1',
    google_scholar: 'javascript:alert(1)',
    id_scopus: '57190000000',
    orcid: 'https://orcid.org/0000-0002-1825-0097',
  },
  municipality: { name: 'BARRANQUILLA', department: { name: 'ATLÁNTICO' } },
  // Cada centro llega completo, con el director y sus datos personales; del grupo solo sale el id.
  centers: [
    {
      id: 3,
      acronym: 'CIISO',
      state: true,
      director: { person: { documentNumber: '22222222', email: 'd@x.co', phone: '3111111111' } },
    },
    { id: 9, acronym: 'CERRADO', state: false },
    { id: 3, acronym: 'CIISO', state: true },
  ],
};

test('proyección pública: lista blanca de campos, sin datos personales ni URLs peligrosas', () => {
  const g = toPublicGroup(raw)!;
  expect(g).toEqual({
    id: 14,
    code: 'COL0016962',
    name: 'Derechos humanos',
    active: true,
    type: 'Institucional',
    ods: [],
    centerIds: [3], // solo activos, sin repetir
    category: 'A1',
    gruplacUrl: raw.url,
    city: 'BARRANQUILLA',
    department: 'ATLÁNTICO',
    foundedYear: 2000,
    leader: {
      name: 'ANA MARIA PEREZ LARA',
      orcid: '0000-0002-1825-0097',
      cvlacUrl: raw.leader.cvlac,
      scholarUrl: null,
      scopusId: '57190000000',
    },
  });
  const json = JSON.stringify(g);
  for (const secret of [
    '99999999',
    '11111111',
    '3000000000',
    '$2b$',
    'm@x.co',
    'l@x.co',
    'mentor',
    '22222222',
    'd@x.co',
    'CIISO',
  ])
    expect(json).not.toContain(secret);
});

test('registros incompletos se descartan', () => {
  expect(toPublicGroup({ id: 1, name: 'Sin código' })).toBeNull();
});

test('líneas: textos vacíos → null; inactivas se descartan', () => {
  expect(
    toPublicLine({
      id: 61,
      code: 'LG061',
      name: 'Ética',
      objective: ' Develar ',
      achievements: '',
      impact: null,
      state: true,
    }),
  ).toEqual({ id: 61, code: 'LG061', name: 'Ética', objective: 'Develar', achievements: null, impact: null });
  expect(toPublicLine({ id: 1, name: 'Vieja', state: false })).toBeNull();
});

test('historial: convocatoria, año y categoría', () => {
  expect(
    toCategoryRecord({
      convocation: { id: 20, nombre: 'Convocatoria 833 de 2018', fecha_inicio: '2018-11-30T05:00:00.000Z' },
      category: 'A1',
    }),
  ).toEqual({
    convocation: 'Convocatoria 833 de 2018',
    year: 2018,
    category: 'A1',
    date: '2018-11-30T05:00:00.000Z',
  });
  expect(toCategoryRecord({ convocation: null, category: 'A' })).toBeNull();
});

test('texto de Word: entidades decodificadas y viñetas de símbolos → •', () => {
  expect(cleanText('&#61532; Generar espacios &amp; reflexión')).toBe('• Generar espacios & reflexión');
  expect(cleanText('Ética &#233;xito')).toBe('Ética éxito');
  expect(cleanText('   ')).toBeNull();
});
