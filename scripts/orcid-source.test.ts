// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, vi } from 'vitest';
import { currentAffiliation, normalizeOrcid } from '../src/domain/orcid/orcid';
import { escapeLucene, fetchOrcidProfile, partialDate, searchOrcid, toOrcidProfile } from './orcid-source';
import { createPublicApi } from './public-api';

const ORCID = '0000-0002-1825-0097';
const date = (year: string, month?: string, day?: string) => ({
  year: { value: year },
  month: month ? { value: month } : null,
  day: day ? { value: day } : null,
});
const summary = (kind: string, extra: object) => ({
  summaries: [
    {
      [`${kind}-summary`]: {
        visibility: 'public',
        source: { 'source-name': { value: 'Universidad X' } },
        ...extra,
      },
    },
  ],
});

/** Registro con la forma real de pub.orcid.org v3.0 (valores ficticios), con datos que NO deben salir. */
const record = {
  'orcid-identifier': { uri: `https://orcid.org/${ORCID}`, path: ORCID, host: 'orcid.org' },
  history: { 'submission-date': { value: 1352723476658 }, 'last-modified-date': { value: 1788275402435 } },
  person: {
    name: {
      'given-names': { value: 'Josiah Stinkney' },
      'family-name': { value: 'Carberry' },
      'credit-name': null,
    },
    biography: { content: 'Investigador de psicocerámica.' },
    addresses: { address: [{ country: { value: 'US' } }] },
    emails: { email: [{ email: 'privado@example.com' }] },
    keywords: { keyword: [{ content: 'secreto' }] },
  },
  'activities-summary': {
    employments: {
      'affiliation-group': [
        summary('employment', {
          'put-code': 1,
          'department-name': 'Psychoceramics',
          'role-title': 'Professor',
          'start-date': date('1930', '02', '29'),
          'end-date': null,
          organization: {
            name: 'Wesleyan University',
            address: { city: 'Middletown', region: 'CT', country: 'US' },
            'disambiguated-organization': {
              'disambiguated-organization-identifier': '05h7xva58',
              'disambiguation-source': 'ROR',
            },
          },
          url: { value: 'https://www.wesleyan.edu' },
        }),
        summary('employment', {
          'put-code': 2,
          'role-title': 'Lecturer',
          'start-date': date('1920'),
          'end-date': date('1929', '12'),
          organization: { name: 'Brown University', address: { city: 'Providence', country: 'US' } },
          url: { value: 'javascript:alert(1)' },
        }),
      ],
    },
    'invited-positions': {
      'affiliation-group': [
        summary('invited-position', { organization: { name: 'MIT' }, 'start-date': date('1950') }),
      ],
    },
    educations: {
      'affiliation-group': [
        summary('education', {
          'department-name': 'Facultad de Ingenierías',
          'role-title': 'Doctorado en Ciencias',
          'start-date': date('1925'),
          'end-date': date('1929'),
          organization: {
            name: 'Universidad Simón Bolívar',
            address: { city: 'Barranquilla', country: 'CO' },
            'disambiguated-organization': {
              'disambiguated-organization-identifier': '6721',
              'disambiguation-source': 'RINGGOLD',
            },
          },
        }),
      ],
    },
    qualifications: { 'affiliation-group': [] },
    works: { group: [{ 'work-summary': [{ title: { title: { value: 'Paper' } } }] }] },
  },
};

test('ORCID: perfil, empleos y educación normalizados; nada fuera de la lista blanca', () => {
  const p = toOrcidProfile(record)!;
  expect(p).toMatchObject({
    orcid: ORCID,
    uri: `https://orcid.org/${ORCID}`,
    givenName: 'Josiah',
    middleName: 'Stinkney',
    familyName: 'Carberry',
    publishedName: null,
    displayName: 'Josiah Stinkney Carberry',
    biography: 'Investigador de psicocerámica.',
    country: 'US',
    createdAt: '2012-11-12T12:31:16.658Z',
  });
  // Vigentes primero (la más reciente primero): el cargo invitado de 1950 antes que el empleo de 1930.
  const [invited, current, past] = p.employments;
  expect(currentAffiliation(p)).toBe(current); // para "cargo actual" se prefiere el empleo
  expect(current).toMatchObject({
    kind: 'employment',
    organization: 'Wesleyan University',
    department: 'Psychoceramics',
    role: 'Professor',
    startDate: '1930-02-29',
    endDate: null,
    current: true,
    city: 'Middletown',
    country: 'US',
    orgId: { source: 'ROR', value: '05h7xva58' },
    ror: 'https://ror.org/05h7xva58',
    url: 'https://www.wesleyan.edu',
    source: 'Universidad X',
    visibility: 'public',
    putCode: 1,
  });
  expect(invited).toMatchObject({ kind: 'invited-position', organization: 'MIT', current: true });
  expect(past).toMatchObject({
    organization: 'Brown University',
    startDate: '1920',
    endDate: '1929-12',
    current: false,
    url: null,
  });
  expect(p.educations).toEqual([
    expect.objectContaining({
      kind: 'education',
      organization: 'Universidad Simón Bolívar',
      department: 'Facultad de Ingenierías',
      role: 'Doctorado en Ciencias',
      startDate: '1925',
      endDate: '1929',
      ror: null,
      orgId: { source: 'RINGGOLD', value: '6721' },
    }),
  ]);
  const json = JSON.stringify(p);
  for (const leaked of ['privado@example.com', 'secreto', 'Paper', 'javascript:'])
    expect(json).not.toContain(leaked);
});

test('ORCID: fechas parciales y registro vacío o sin identificador', () => {
  expect(partialDate(date('2020'))).toBe('2020');
  expect(partialDate(date('2020', '03'))).toBe('2020-03');
  expect(partialDate(date('2020', '03', '15'))).toBe('2020-03-15');
  expect(partialDate(null)).toBeNull();
  expect(partialDate({ year: { value: '20x0' } })).toBeNull();
  expect(toOrcidProfile({})).toBeNull();
  const minimal = toOrcidProfile({ 'orcid-identifier': { path: ORCID } })!;
  expect(minimal).toMatchObject({ displayName: ORCID, employments: [], educations: [], country: null });
  expect(
    toOrcidProfile({
      ...record,
      person: {
        ...record.person,
        name: { ...record.person.name, 'credit-name': { value: 'J. S. Carberry' } },
      },
    })!.displayName,
  ).toBe('J. S. Carberry'); // nombre publicado
});

test('ORCID: 404/409 => null, error de servidor => excepción', async () => {
  const fetchMock = vi.fn(async (url: string) =>
    url.includes('0000-0002-1694-233X')
      ? new Response('', { status: 404 })
      : url.includes('0000-0001-5109-3700')
        ? new Response('', { status: 409 })
        : url.includes('0000-0003-1415-9269')
          ? new Response('', { status: 503 })
          : Response.json(record),
  );
  vi.stubGlobal('fetch', fetchMock);
  try {
    expect((await fetchOrcidProfile(ORCID, 'http://orcid/v3.0/'))!.orcid).toBe(ORCID);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://orcid/v3.0/${ORCID}/record`,
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    );
    expect(await fetchOrcidProfile('0000-0002-1694-233X', 'http://orcid')).toBeNull();
    expect(await fetchOrcidProfile('0000-0001-5109-3700', 'http://orcid')).toBeNull();
    await expect(fetchOrcidProfile('0000-0003-1415-9269', 'http://orcid')).rejects.toThrow('HTTP 503');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('dominio: normalizeOrcid valida formato y dígito de control (igual que el backend)', () => {
  expect(normalizeOrcid('https://orcid.org/0000-0002-1825-0097')).toBe(ORCID);
  expect(normalizeOrcid(' 0000000218250097 ')).toBe(ORCID);
  expect(normalizeOrcid('0000-0002-1694-233x')).toBe('0000-0002-1694-233X');
  for (const bad of ['', '1234', '0000-0002-1825-0098', 'https://evil.com/0000-0002-1825-0097', null])
    expect(normalizeOrcid(bad)).toBeNull();
});

const SEARCH = {
  'num-found': 2,
  'expanded-result': [
    {
      'orcid-id': ORCID,
      'given-names': 'Josiah',
      'family-names': 'Carberry',
      'credit-name': 'Josiah Carberry',
      email: ['josiah@example.org'], // público en ORCID, pero no sale del BFF
      'institution-name': ['Wesleyan University', 'Brown University', 'Wesleyan University', 'A', 'B'],
    },
    { 'orcid-id': '0000-0001-5109-3700', 'given-names': 'Laure', 'family-names': 'Haak' },
    { 'given-names': 'Sin iD' },
  ],
};

test('ORCID búsqueda: el texto se escapa (nunca es sintaxis Lucene) y solo sale la lista blanca', async () => {
  expect(escapeLucene('a+b (c) "d" e:f/g*')).toBe(String.raw`a\+b \(c\) \"d\" e\:f\/g\*`);
  const fetchMock = vi.fn(async () => Response.json(SEARCH));
  vi.stubGlobal('fetch', fetchMock);
  try {
    expect(await searchOrcid('  josiah   carb* ', 'http://orcid/v3.0/')).toEqual([
      { orcid: ORCID, name: 'Josiah Carberry', institutions: ['Wesleyan University', 'Brown University', 'A'] },
      { orcid: '0000-0001-5109-3700', name: 'Laure Haak', institutions: [] },
    ]);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/v3.0/expanded-search/');
    expect(url.searchParams.get('q')).toBe(
      String.raw`given-and-family-names:(josiah carb\*) OR other-names:(josiah carb\*)`,
    );
    expect(url.searchParams.get('rows')).toBe('8');
  } finally {
    vi.unstubAllGlobals();
  }
});

describe('BFF /api/orcid/{orcid}', () => {
  let base = '';
  let server: http.Server;
  const realFetch = globalThis.fetch;
  const orcidCalls = vi.fn();
  beforeAll(async () => {
    const handler = createPublicApi({ metrikUrl: 'http://metrik/api', orcidUrl: 'http://orcid/v3.0' });
    vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
      if (!input.startsWith('http://orcid')) return realFetch(input, init);
      orcidCalls(input);
      if (input.includes('/expanded-search/')) return Response.json(SEARCH);
      return input.includes('0000-0002-1694-233X')
        ? new Response('', { status: 404 })
        : Response.json(record);
    });
    server = http.createServer((req, res) => void handler(req, res));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
    vi.unstubAllGlobals();
  });

  test('perfil público, ORCID inválido (400), inexistente (404) y caché por persona', async () => {
    const r = await realFetch(`${base}/api/orcid/${ORCID}`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ orcid: ORCID, displayName: 'Josiah Stinkney Carberry' });
    expect((await realFetch(`${base}/api/orcid/https%3A%2F%2Forcid.org%2F${ORCID}`)).status).toBe(200); // URL aceptada
    expect(orcidCalls).toHaveBeenCalledTimes(1); // cacheado
    expect((await realFetch(`${base}/api/orcid/0000-0002-1825-0098`)).status).toBe(400); // dígito de control
    expect((await realFetch(`${base}/api/orcid/hola`)).status).toBe(400);
    expect((await realFetch(`${base}/api/orcid/0000-0002-1694-233X`)).status).toBe(404);
  });

  test('búsqueda por nombre: mínimo 3 letras, caché por término, sin email', async () => {
    orcidCalls.mockClear();
    expect(await (await realFetch(`${base}/api/orcid/search?q=jo`)).json()).toEqual([]);
    expect(orcidCalls).not.toHaveBeenCalled();
    const r = await realFetch(`${base}/api/orcid/search?q=Josiah%20Carberry`);
    expect(r.status).toBe(200);
    const hits = await r.json();
    expect(hits[0]).toEqual({ orcid: ORCID, name: 'Josiah Carberry', institutions: ['Wesleyan University', 'Brown University', 'A'] });
    expect(JSON.stringify(hits)).not.toContain('@');
    await realFetch(`${base}/api/orcid/search?q=josiah%20carberry`); // mismo término en minúsculas
    expect(orcidCalls).toHaveBeenCalledTimes(1);
  });
});
