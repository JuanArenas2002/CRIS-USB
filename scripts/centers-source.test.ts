// @vitest-environment node
import { toCenterResolution, toPublicCenter } from './centers-source';

const person = {
  name: 'GLORIA MARIA',
  lastname: 'NARANJO AFRICANO',
  documentNumber: '11111111',
  email: 'p@x.co',
  phone: '3000000000',
  born_date: '1970-01-01',
  gender: 'F',
};
const raw = {
  id: 1,
  code: 'CI-1',
  name: 'Centro de Crecimiento Empresarial MACONDOLAB',
  acronym: 'MACONDOLAB',
  state: true,
  date_created: '2004-08-20T00:00:00.000Z',
  director: {
    person,
    name_standard: 'Variante 1, Variante 2, , Otra',
    orcid: 'https://orcid.org/0000-0001-9610-1604',
    cvlac: 'https://scienti.minciencias.gov.co/cvlac/x',
    google_scholar: 'http://inseguro.com/x',
    id_scopus: '57965037000;36998519000',
  },
  municipality: { code: '08001', name: 'BARRANQUILLA', department: { name: 'ATLÁNTICO' } },
};

test('centro: lista blanca de campos, nombre del director desde la persona, sin datos personales', () => {
  const c = toPublicCenter(raw)!;
  expect(c).toEqual({
    id: 1,
    code: 'CI-1',
    acronym: 'MACONDOLAB',
    name: 'Centro de Crecimiento Empresarial MACONDOLAB',
    active: true,
    createdAt: '2004-08-20',
    foundedYear: 2004,
    city: 'BARRANQUILLA',
    department: 'ATLÁNTICO',
    daneCode: '08001',
    director: {
      name: 'GLORIA MARIA NARANJO AFRICANO',
      orcid: '0000-0001-9610-1604',
      cvlacUrl: 'https://scienti.minciencias.gov.co/cvlac/x',
      scholarUrl: null, // no es https ni de Google Scholar
      scopusId: '57965037000', // el primero de la lista
    },
  });
  const text = JSON.stringify(c);
  for (const s of ['11111111', 'p@x.co', '3000000000', '1970-01-01']) expect(text).not.toContain(s);
});

test('centro: el registro vacío de Metri-K ("N/A") no se publica; inactivo sí, con su estado', () => {
  expect(
    toPublicCenter({ id: 0, code: 'N/A', name: 'N/A', director: { person: { name: 'N/A' } } }),
  ).toBeNull();
  expect(toPublicCenter({ ...raw, state: false })?.active).toBe(false);
});

test('resolución: metadatos sin el PDF en base64', () => {
  const r = toCenterResolution({
    id: 5,
    number: 'Resolucion_0350-2026',
    type: 'Reconocimiento',
    date: '2026-04-16T05:00:00.000Z',
    description: 'Reconoce oficialmente al centro',
    file: 'JVBERi0xLjQKJ…',
  })!;
  expect(r).toEqual({
    id: 5,
    number: 'Resolucion 0350-2026',
    type: 'Reconocimiento',
    date: '2026-04-16',
    description: 'Reconoce oficialmente al centro',
    hasFile: true,
  });
  expect(JSON.stringify(r)).not.toContain('JVBERi');
});
