// @vitest-environment node
import { toPublicInvestigator } from './investigators-source';

// Forma real de un elemento de GET /api/investigator (valores ficticios).
const raw = {
  id: 359,
  name_standard: 'PEREZ LARA, ANA MARIA',
  lastCategory: 'Sénior (IS)',
  state_gruplac: true,
  contracted: true,
  lastHours: 20,
  orcid: 'https://orcid.org/0000-0002-1825-0097',
  id_scopus: '57190000000',
  cvlac: 'https://scienti.minciencias.gov.co/cvlac/visualizador/generarCurriculoCv.do?cod_rh=1',
  google_scholar: 'http://inseguro.example/scholar',
  authorId: 'https://publons.com/researcher/1/x',
  person: {
    documentNumber: '11111111',
    email: 'ana@x.co',
    phone: '3000000000',
    gender: 'Femenino',
    ethnicity: 'X',
    level_education: 'Doctorado',
  },
  groupMain: { id: 14, code: 'COL0016962', name: 'Derechos humanos', mentorId: 1, leaderId: 2 },
};

test('proyección pública: lista blanca, sin datos personales ni URLs no seguras', () => {
  const a = toPublicInvestigator(raw)!;
  expect(a).toEqual({
    id: 359,
    name: 'ANA MARIA PEREZ LARA',
    category: 'senior',
    degree: 'Doctorado',
    orcid: '0000-0002-1825-0097',
    scopusId: '57190000000',
    cvlacUrl: raw.cvlac,
    scholarUrl: null,
    mainGroup: { id: 14, code: 'COL0016962', name: 'Derechos humanos' },
    metrics: null,
    photoUrl: null,
  });
  const json = JSON.stringify(a);
  for (const secret of ['11111111', 'ana@x.co', '3000000000', 'Femenino', 'publons', '"lastHours"'])
    expect(json).not.toContain(secret);
});

test('solo investigadores activos en GrupLAC', () => {
  expect(toPublicInvestigator({ ...raw, state_gruplac: false })).toBeNull();
  expect(toPublicInvestigator({ ...raw, name_standard: null, person: {} })).toBeNull();
});
