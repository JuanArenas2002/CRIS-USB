// @vitest-environment node
import { toCountry, toCountryPublication } from './collaboration-source';

test('país: ISO alfa-2, alfa-3 y numérico de 3 dígitos (el id del mapa); sin ISO válido se descarta', () => {
  expect(
    toCountry({
      iso2: 'co',
      iso3: 'COL',
      iso_numeric: '170',
      country: 'Colombia',
      collaboration_type: 'nacional',
      total_publications: 1352,
      total_citations: 14354,
    }),
  ).toEqual({
    iso2: 'CO',
    iso3: 'COL',
    isoNumeric: '170',
    country: 'Colombia',
    local: true,
    publications: 1352,
    citations: 14354,
  });
  expect(toCountry({ iso2: 'AF', iso3: 'AFG', iso_numeric: '4', country: 'Afghanistan' })?.isoNumeric).toBe(
    '004',
  );
  expect(toCountry({ country: 'Desconocido', total_publications: 7 })).toBeNull();
});

test('publicación: tipo documental legible y sin el detalle de autores (ORCID, país de cada uno)', () => {
  const p = toCountryPublication({
    eid: '2-s2.0-1',
    title: 'Paper',
    year: 2024,
    doi: '10.1/x',
    journal: 'Sports',
    doc_type: 'CONFERENCE PAPER',
    citations: 3,
    quartile: 'q2',
    partner_institutions: ['Universidad Europea de Madrid'],
    own_authors_detalle: [{ orcid: '0000-0002-8171-662X' }],
  })!;
  expect(p).toMatchObject({
    docType: 'Conference paper',
    quartile: 'Q2',
    partners: ['Universidad Europea de Madrid'],
  });
  expect(JSON.stringify(p)).not.toContain('0000-0002-8171-662X');
});
