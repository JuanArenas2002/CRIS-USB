// @vitest-environment node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, vi } from 'vitest';
import { createPublicApi } from './public-api';

// Metri-K simulado con su forma real (valores ficticios), incluidos los datos personales que NO deben salir.
const person = {
  documentNumber: '11111111',
  email: 'p@x.co',
  phone: '3000000000',
  level_education: 'Doctorado',
};
const inv = (id: number, name: string, extra = {}) => ({
  id,
  name_standard: name,
  lastCategory: 'Junior (IJ)',
  state_gruplac: true,
  person,
  groupMain: { id: 14, code: 'COL1', name: 'Grupo Uno' },
  ...extra,
});
const groupRaw = {
  id: 14,
  code: 'COL1',
  name: 'Grupo Uno',
  state: true,
  lastCategory: 'A1',
  mentor: { user: { username: 'mentor', password: '$2b$10$hash' }, person },
};
// Interinstitucional: sale en el listado, pero sin ficha ni integrantes.
const interRaw = {
  id: 15,
  code: 'COL2',
  name: 'Grupo Inter',
  state: true,
  lastCategory: 'B',
  type: 'Interinstitucional',
};
// Centros (forma real de Metri-K): director con datos personales, registro vacío "N/A" y PDF en base64.
const PDF = Buffer.from('%PDF-1.4 resolución de prueba');
const centerRaw = {
  id: 1,
  code: 'CI-1',
  name: 'Centro Uno',
  acronym: 'CU',
  state: true,
  date_created: '2004-08-20T00:00:00.000Z',
  director: { person: { ...person, name: 'ANA', lastname: 'PEREZ' }, orcid: '0000-0002-1825-0097' },
  municipality: { code: '08001', name: 'BARRANQUILLA', department: { name: 'ATLÁNTICO' } },
};
const centersMock: Record<string, unknown[]> = {
  '/api/center': [centerRaw, { id: 0, code: 'N/A', name: 'N/A', director: { person: { name: 'N/A' } } }],
  '/api/center/investigator/1': [centerRaw],
  '/api/lineCenter/center/1': [{ id: 3, code: 'LC001', name: 'Emprendimiento', state: true }],
  '/api/ods/center/1': [
    { id: 1, number: '17', title: 'Alianzas' },
    { id: 2, number: '8', title: 'Trabajo' },
  ],
  '/api/resolutionCenter/center/1': [
    {
      id: 9,
      number: 'Resolucion 1',
      type: 'Reconocimiento',
      date: '2022-12-14T05:00:00.000Z',
      file: PDF.toString('base64'),
    },
  ],
};
const metrik = vi.fn(async (url: string) => {
  const p = new URL(url).pathname;
  const data =
    p === '/api/investigator/seleccionados'
      ? [
          {
            id: 1,
            authorsIds: [
              { authorId: '57000000007', indice_h: '7' },
              { authorId: '57000000012', indice_h: '12' },
              { authorId: '57000000099', indice_h: '' },
            ],
            produccion: {
              totales: { publicacionesScopus: 1, total: 2 },
              publicacionesScopus: [
                {
                  id: 5,
                  title: 'Paper',
                  year: 2024,
                  citedBy: 3,
                  link: 'https://www.scopus.com/x',
                  doi: '10.1000/xyz',
                  eid: '2-s2.0-85000000005',
                },
              ],
              trabajosDeFormacion: [
                { id: 6, titulo: 'Tesis', year: '2023', tipo: 'Maestria', enlace_bonga: 'http://inseguro/x' },
              ],
              desarrollosTecnologicos: [],
            },
          },
        ]
      : p === '/api/investigator'
        ? [
            inv(1, 'PEREZ, ANA', { lastCategory: 'Sénior (IS)' }),
            inv(2, 'GOMEZ, LUIS', { person: { ...person, documentNumber: '22.222.222' } }),
            inv(3, 'RETIRADO, JUAN', {
              state_gruplac: false,
              person: { ...person, documentNumber: '33333333' },
            }),
          ]
        : p.startsWith('/api/group/investigator/')
          ? p.endsWith('/1')
            ? [groupRaw]
            : []
          : p === '/api/group'
            ? [groupRaw, interRaw]
            : p.startsWith('/api/lineGroup/') || p.startsWith('/api/group/categories/')
              ? []
              : p.startsWith('/api/ods/group/')
                ? // Forma real: { id, number (texto), title, description }; repetidos y desordenados.
                  p.endsWith('/14')
                  ? [
                      { id: 17, number: '17', title: 'Alianzas', description: 'x' },
                      { id: 3, number: '3', title: 'Salud', description: 'x' },
                      { id: 3, number: '3', title: 'Salud', description: 'x' },
                      { id: 5, number: '5', title: 'Género', description: 'x' },
                    ]
                  : []
                : (centersMock[p] ?? null);
  return data ? Response.json({ data, message: 'ok' }) : Response.json({ message: 'x' }, { status: 404 });
});

const TOKEN = 'secreto-de-prueba';
let photosDir = '';
let odsDir = '';
let base = '';
let server: http.Server;
const realFetch = globalThis.fetch;
beforeAll(async () => {
  photosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cris-photos-'));
  odsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cris-ods-'));
  const handler = createPublicApi({
    metrikUrl: 'http://metrik/api',
    photosDir,
    logosDir: path.join(odsDir, 'logos'),
    sitesFile: path.join(odsDir, 'center-sites.json'),
    rankingFile: path.join(odsDir, 'ranking.json'),
    rankingHiddenFile: path.join(odsDir, 'ranking-hidden.json'),
    publicationsFile: path.join(odsDir, 'publications.json'),
    adminToken: TOKEN,
  });
  vi.stubGlobal('fetch', (input: string, init?: RequestInit) =>
    input.startsWith('http://metrik') ? metrik(input) : realFetch(input, init),
  );
  server = http.createServer((req, res) => void handler(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(photosDir, { recursive: true, force: true });
  fs.rmSync(odsDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

const get = async (path: string) => {
  const res = await fetch(base + path);
  const text = await res.text();
  return { status: res.status, text, body: JSON.parse(text) };
};
const SECRETS = ['11111111', 'p@x.co', '3000000000', '$2b$', 'mentor'];

test('investigadores: solo los seleccionados y activos en GrupLAC, sin datos personales', async () => {
  const { status, text, body } = await get('/api/investigators?size=5000');
  expect(status).toBe(200);
  expect(body.items.map((a: { id: number }) => a.id)).toEqual([1]); // 2 no está seleccionado
  expect(body.items[0].centers).toEqual([
    { id: 1, code: 'CI-1', acronym: 'CU', name: 'Centro Uno', logoUrl: null },
  ]);
  for (const s of SECRETS) expect(text).not.toContain(s);
  expect((await get('/api/investigators?cat=junior')).body.total).toBe(0);
  expect((await get('/api/investigators?q=perez')).body.items[0].name).toBe('ANA PEREZ');
});

test('detalle con grupos proyectados; inexistente o retirado → 404', async () => {
  const { body, text } = await get('/api/investigators/1');
  expect(body.groups).toEqual([
    { id: 14, code: 'COL1', name: 'Grupo Uno', category: 'A1', ods: [3, 5, 17], type: null },
  ]);
  for (const s of SECRETS) expect(text).not.toContain(s);
  expect(body.centers).toEqual([{ id: 1, code: 'CI-1', acronym: 'CU', name: 'Centro Uno', logoUrl: null }]);
  expect((await get('/api/investigators/3')).status).toBe(404);
  expect((await get('/api/investigators/999')).status).toBe(404);
});

test('estadísticas por categoría', async () => {
  expect((await get('/api/investigators/stats')).body).toEqual({
    total: 1,
    byCategory: { emerito: 0, senior: 1, asociado: 0, junior: 0 },
  });
});

test('solo lectura y solo rutas permitidas', async () => {
  expect((await fetch(`${base}/api/investigators`, { method: 'POST' })).status).toBe(405);
  expect((await get('/api/authors')).status).toBe(404);
  expect((await get('/api/group')).status).toBe(404);
});

test('destacados: métricas (mayor índice H) y producción en el detalle', async () => {
  const featured = (await get('/api/investigators/featured')).body;
  expect(featured.map((a: { id: number }) => a.id)).toEqual([1]);
  expect(featured[0].metrics).toEqual({ hIndex: 12, scopusPublications: 1, products: 2 });
  expect(featured[0]).toMatchObject({ scopusId: '57000000012' }); // perfil de mayor H
  const { body } = await get('/api/investigators/1');
  expect(body.production.publications[0]).toMatchObject({ title: 'Paper', citedBy: 3, doi: '10.1000/xyz' });
  expect(body.production.theses[0].url).toBeNull(); // URL no segura descartada
  expect((await get('/api/investigators/2')).status).toBe(404); // no seleccionado → no público
});

// WebP mínimo válido para la cabecera (RIFF....WEBP); el contenido no se decodifica en el servidor.
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]);
const put = (id: number, body: Buffer, token?: string) =>
  fetch(`${base}/api/investigators/${id}/photo`, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: token ? { 'X-Admin-Token': token } : {},
  });

test('fotos: escritura solo con token, solo WebP y solo para investigadores publicados', async () => {
  expect((await put(1, WEBP)).status).toBe(401);
  expect((await put(1, WEBP, 'otro')).status).toBe(401);
  expect((await put(1, Buffer.from('<svg/>'), TOKEN)).status).toBe(400);
  expect((await put(2, WEBP, TOKEN)).status).toBe(404); // no seleccionado
  expect((await put(1, Buffer.alloc(1024 * 1024 + 1), TOKEN)).status).toBe(413);
  expect(fs.readdirSync(photosDir)).toEqual([]);
});

test('fotos: guardar, aparecer en el listado, servir y quitar', async () => {
  const res = await put(1, WEBP, TOKEN);
  expect(res.status).toBe(200);
  const { photoUrl } = await res.json();
  expect(photoUrl).toMatch(/^\/api\/investigators\/1\/photo\?v=\d+$/);
  expect((await get('/api/investigators')).body.items[0].photoUrl).toBe(photoUrl);

  const img = await fetch(base + photoUrl);
  expect(img.headers.get('content-type')).toBe('image/webp');
  expect(img.headers.get('cache-control')).toContain('immutable');
  expect(Buffer.from(await img.arrayBuffer())).toEqual(WEBP);

  const del = await fetch(`${base}/api/investigators/1/photo`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': TOKEN },
  });
  expect(await del.json()).toEqual({ photoUrl: null });
  expect((await fetch(base + photoUrl)).status).toBe(404);
});

test('fotos: otra instancia del BFF (otro proceso o reinicio) ve la foto guardada', async () => {
  const res = await put(1, WEBP, TOKEN);
  const { photoUrl } = await res.json();
  // Mismos archivos que la instancia principal (nunca los de data/ del equipo).
  const other = createPublicApi({
    metrikUrl: 'http://metrik/api',
    photosDir,
    rankingFile: path.join(odsDir, 'ranking.json'),
    rankingHiddenFile: path.join(odsDir, 'ranking-hidden.json'),
    adminToken: TOKEN,
  });
  const srv = http.createServer((req, r) => void other(req, r));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  const body = await (await fetch(`http://127.0.0.1:${port}/api/investigators/1`)).json();
  srv.close();
  expect(body.photoUrl).toBe(photoUrl);
});

test('ODS de los grupos: de Metri-K (solo el número), normalizados, en listado, detalle y perfil', async () => {
  expect((await get('/api/groups/14')).body.ods).toEqual([3, 5, 17]);
  expect((await get('/api/groups')).body[0].ods).toEqual([3, 5, 17]);
  // El investigador hereda los ODS de sus grupos (el 1 pertenece al grupo 14).
  expect((await get('/api/investigators/1')).body.groups[0].ods).toEqual([3, 5, 17]);
  expect((await get('/api/groups/14')).text).not.toContain('Alianzas'); // ni título ni descripción
  // Ya no se asignan en el portal: el endpoint de escritura no existe.
  const put = await fetch(`${base}/api/groups/14/ods`, {
    method: 'PUT',
    body: JSON.stringify({ ods: [1] }),
    headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
  });
  expect(put.ok).toBe(false);
});

test('centros: listado y detalle sin datos personales ni PDF; el registro "N/A" no sale', async () => {
  const list = await get('/api/centers');
  expect(list.body.map((c: { code: string }) => c.code)).toEqual(['CI-1']);
  expect(list.body[0]).toMatchObject({ acronym: 'CU', daneCode: '08001', ods: [8, 17], linesCount: 1 });
  expect(list.body[0]).not.toHaveProperty('resolutions');
  const detail = await get('/api/centers/1');
  expect(detail.body.director.name).toBe('ANA PEREZ');
  expect(detail.body.resolutions).toEqual([
    expect.objectContaining({ id: 9, type: 'Reconocimiento', date: '2022-12-14', hasFile: true }),
  ]);
  for (const t of [list.text, detail.text]) {
    for (const s of SECRETS) expect(t).not.toContain(s);
    expect(t).not.toContain(PDF.toString('base64'));
  }
  expect((await get('/api/centers/0')).status).toBe(404);
});

test('centros: el PDF de la resolución se sirve aparte, solo si existe', async () => {
  const res = await fetch(`${base}/api/centers/1/resolutions/9`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('application/pdf');
  expect(Buffer.from(await res.arrayBuffer())).toEqual(PDF);
  expect((await fetch(`${base}/api/centers/1/resolutions/99`)).status).toBe(404);
});

test('centros: logo (WebP, con token) y página oficial (URL http/s) asignados por el admin', async () => {
  const send = (sub: string, method: string, body?: BodyInit, token = TOKEN) =>
    fetch(`${base}/api/centers/1/${sub}`, { method, body, headers: { 'X-Admin-Token': token } });
  expect((await send('logo', 'PUT', new Uint8Array(WEBP), 'otro')).status).toBe(401);
  expect((await send('logo', 'PUT', '<svg/>')).status).toBe(400);
  expect(
    (await fetch(`${base}/api/centers/0/logo`, { method: 'PUT', headers: { 'X-Admin-Token': TOKEN } }))
      .status,
  ).toBe(404);
  const { logoUrl } = await (await send('logo', 'PUT', new Uint8Array(WEBP))).json();
  expect(logoUrl).toMatch(/^\/api\/centers\/1\/logo\?v=\d+$/);
  expect(Buffer.from(await (await fetch(base + logoUrl)).arrayBuffer())).toEqual(WEBP);

  expect((await send('website', 'PUT', JSON.stringify({ website: 'javascript:alert(1)' }))).status).toBe(400);
  expect((await send('website', 'PUT', JSON.stringify({ website: 'nada' }))).status).toBe(400);
  expect(await (await send('website', 'PUT', JSON.stringify({ website: 'www.cu.co' }))).json()).toEqual({
    website: 'https://www.cu.co/',
  });
  expect((await get('/api/centers')).body[0]).toMatchObject({ logoUrl, website: 'https://www.cu.co/' });
  expect((await get('/api/centers/1')).body).toMatchObject({ logoUrl, website: 'https://www.cu.co/' });

  expect(await (await send('logo', 'DELETE')).json()).toEqual({ logoUrl: null });
  expect(await (await send('website', 'PUT', JSON.stringify({ website: null }))).json()).toEqual({
    website: null,
  });
  expect((await get('/api/centers/1')).body).toMatchObject({ logoUrl: null, website: null });
});

test('grupos interinstitucionales: en el listado, pero sin detalle ni integrantes', async () => {
  expect((await get('/api/groups')).body.map((g: { id: number }) => g.id)).toContain(15);
  expect((await get('/api/groups/15')).status).toBe(404);
  expect((await get('/api/groups/15/members')).status).toBe(404);
  expect((await get('/api/groups/14')).status).toBe(200);
});

test('ranking USB: decide quién se publica, por cédula; la cédula no sale ni se guarda', async () => {
  const send = (method: string, body?: unknown, token = TOKEN) =>
    fetch(`${base}/api/ranking`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
    });
  const row = (cc: string, name: string, rank: number, index: number, center: string | null = null) => ({
    cc,
    name,
    rank,
    index,
    center,
    centerRank: center ? 1 : null,
  });
  expect((await send('PUT', { rows: [row('11111111', 'Ana', 1, 90)] }, 'otro')).status).toBe(401);
  expect((await send('PUT', { rows: [] })).status).toBe(400);

  const res = await send('PUT', {
    rows: [
      row('11111111', 'Ana', 3, 88.25, 'CU'),
      row('22222222', 'Luis', 1, 90), // en Metri-K con puntos: se compara solo por dígitos
      row('33333333', 'Juan', 2, 80), // inactivo en GrupLAC
      row('999', 'Nadie', 4, 70),
      row('22222222', 'Mal', 0, 50), // sin puesto
    ],
  });
  expect(await res.json()).toEqual({
    published: 2,
    notFound: ['Nadie'],
    inactive: ['Juan'],
    invalid: ['Mal'],
  });

  const list = await get('/api/investigators?size=50');
  expect(list.body.items.map((a: { id: number }) => a.id).sort()).toEqual([1, 2]); // 2 no era seleccionado
  // Puestos renumerados entre los publicados: el #2 del Excel (Juan) está inactivo, Ana sube al #2.
  expect(list.body.items.find((a: { id: number }) => a.id === 1).ranking).toEqual({
    index: 88.3,
    rank: 2,
    centerRank: 1,
    center: 'CU',
  });
  expect(list.text).not.toContain('22222222');
  expect(fs.readFileSync(path.join(odsDir, 'ranking.json'), 'utf8')).not.toContain('22222222');

  // Admin: la lista exige token y no se guarda en caché.
  expect((await fetch(`${base}/api/ranking`)).status).toBe(401);
  const adminList = await send('GET');
  expect(adminList.headers.get('cache-control')).toBe('no-store');
  expect((await adminList.json()).rows.map((r: { id: number; rank: number }) => [r.id, r.rank])).toEqual([
    [2, 1],
    [1, 3],
  ]);

  // Ocultar al #1: Ana pasa a mostrarse como #1; ocultos se recuerdan al cargar otro Excel.
  const hide = (id: number, visible: boolean) =>
    fetch(`${base}/api/ranking/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ visible }),
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
    });
  expect((await hide(2, false)).status).toBe(200);
  expect((await hide(999, false)).status).toBe(404);
  const afterHide = (await get('/api/investigators?size=50')).body.items;
  expect(afterHide.map((a: { id: number; ranking: { rank: number } }) => [a.id, a.ranking.rank])).toEqual([
    [1, 1],
  ]);
  await send('PUT', { rows: [row('11111111', 'Ana', 3, 88, 'CU'), row('22222222', 'Luis', 1, 90)] });
  expect((await get('/api/investigators?size=50')).body.items.map((a: { id: number }) => a.id)).toEqual([1]);
  expect((await hide(2, true)).status).toBe(200);
  expect((await get('/api/investigators?size=50')).body.total).toBe(2);

  // Desactivar / activar varios en una sola llamada (ids fuera del ranking se ignoran).
  const many = (ids: unknown, visible: unknown) =>
    fetch(`${base}/api/ranking/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ ids, visible }),
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': TOKEN },
    });
  expect((await many(['x'], false)).status).toBe(400);
  expect((await many([1, 2, 999], false)).status).toBe(200);
  expect((await get('/api/investigators?size=50')).body.total).toBe(0);
  expect((await many([1, 2], true)).status).toBe(200);
  expect((await get('/api/investigators?size=50')).body.total).toBe(2);

  // Sin ranking, vuelven los seleccionados de Metri-K.
  expect((await send('DELETE')).status).toBe(200);
  expect((await get('/api/investigators?size=50')).body.items.map((a: { id: number }) => a.id)).toEqual([1]);
});

test('ranking de publicaciones: carga con token, autores por EID y consulta pública filtrable', async () => {
  const send = (method: string, body?: unknown, token = TOKEN) =>
    fetch(`${base}/api/publications`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
    });
  const row = (rank: number, eid: string, over = {}) => ({
    rank,
    score: 90 - rank,
    eid,
    doi: null,
    title: `Paper ${rank}`,
    abstract: null,
    year: 2024,
    type: 'Article',
    journal: 'Journal',
    quartile: 'Q2',
    areas: ['Natural Sciences'],
    citations: 3,
    openAccess: false,
    international: false,
    countries: ['Colombia'],
    correspondence: false,
    authorsCount: 2,
    ...over,
  });
  expect((await send('PUT', { rows: [row(1, '2-s2.0-1000001')] }, 'otro')).status).toBe(401);
  expect((await send('PUT', { rows: [] })).status).toBe(400);
  expect((await fetch(`${base}/api/publications`, { method: 'DELETE' })).status).toBe(401);

  const res = await send('PUT', {
    rows: [
      row(1, '2-s2.0-1000001', { quartile: 'Q1', openAccess: true }), // sin autor seleccionado
      row(2, '2-s2.0-85000000005', { doi: '10.1000/xyz' }), // de Ana (id 1) en Metri-K
      row(5, '2-s2.0-85000000005'), // repetido: queda el mejor puesto
      row(9, 'no-es-eid'),
    ],
  });
  expect(await res.json()).toEqual({ published: 2, invalid: ['#9 no-es-eid'], unlinked: 1 });

  const list = await get('/api/publications');
  expect(list.body).toMatchObject({ total: 2, page: 1, pages: 1 });
  expect(list.body.items.map((p: { rank: number }) => p.rank)).toEqual([1, 2]);
  expect(list.body.items[0].authors).toEqual([]);
  expect(list.body.items[1].authors).toEqual([{ id: 1, name: expect.any(String), published: true }]);
  expect((await get('/api/publications?quartile=Q1')).body.total).toBe(1);
  // Con filtro, el puesto se recalcula dentro del resultado; `rank` sigue siendo el general.
  expect((await get('/api/publications?quartile=Q2&from=2020&to=2024')).body.items).toMatchObject([
    { rank: 2, position: 1 },
  ]);
  expect((await get('/api/publications?from=2025')).body.total).toBe(0);
  expect((await get('/api/publications?oa=1&q=paper%202')).body.total).toBe(0);
  expect((await get('/api/publications?sort=cited&size=1&page=2')).body.items[0].rank).toBe(2);
  expect((await get('/api/publications/stats')).body).toMatchObject({
    total: 2,
    byQuartile: { Q1: 1, Q2: 1, Q3: 0, Q4: 0 },
    openAccess: 1,
    years: [2024],
  });

  expect((await send('DELETE')).status).toBe(200);
  expect((await get('/api/publications')).body.total).toBe(0);
});

test('JSON pequeño sin comprimir aunque se acepte gzip (no compensa)', async () => {
  // Los grandes (>1 KB) salen con gzip: se verifica contra el servidor real con datos de Metri-K.
  const res = await fetch(`${base}/api/groups/14`, { headers: { 'Accept-Encoding': 'gzip' } });
  expect(res.headers.get('content-encoding')).toBeNull();
  expect((await res.json()).id).toBe(14);
});
