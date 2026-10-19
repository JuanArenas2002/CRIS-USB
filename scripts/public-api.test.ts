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
const metrik = vi.fn(async (url: string) => {
  const p = new URL(url).pathname;
  const data =
    p === '/api/investigator/seleccionados'
      ? [
          {
            id: 1,
            authorsIds: [{ indice_h: '7' }, { indice_h: '12' }, { indice_h: '' }],
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
            inv(2, 'GOMEZ, LUIS'),
            inv(3, 'RETIRADO, JUAN', { state_gruplac: false }),
          ]
        : p.startsWith('/api/group/investigator/')
          ? p.endsWith('/1')
            ? [groupRaw]
            : []
          : p === '/api/group'
            ? [groupRaw]
            : p.startsWith('/api/lineGroup/') || p.startsWith('/api/group/categories/')
              ? []
              : null;
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
    odsFile: path.join(odsDir, 'ods.json'),
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
  for (const s of SECRETS) expect(text).not.toContain(s);
  expect((await get('/api/investigators?cat=junior')).body.total).toBe(0);
  expect((await get('/api/investigators?q=perez')).body.items[0].name).toBe('ANA PEREZ');
});

test('detalle con grupos proyectados; inexistente o retirado → 404', async () => {
  const { body, text } = await get('/api/investigators/1');
  expect(body.groups).toEqual([{ id: 14, code: 'COL1', name: 'Grupo Uno', category: 'A1', ods: [] }]);
  for (const s of SECRETS) expect(text).not.toContain(s);
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
  const other = createPublicApi({ metrikUrl: 'http://metrik/api', photosDir, adminToken: TOKEN });
  const srv = http.createServer((req, r) => void other(req, r));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  const body = await (await fetch(`http://127.0.0.1:${port}/api/investigators/1`)).json();
  srv.close();
  expect(body.photoUrl).toBe(photoUrl);
});

const putOds = (id: number, body: unknown, token?: string) =>
  fetch(`${base}/api/groups/${id}/ods`, {
    method: 'PUT',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Admin-Token': token } : {}) },
  });

test('ODS: escritura solo con token, solo grupos activos y solo números del 1 al 17', async () => {
  expect((await putOds(14, { ods: [3] })).status).toBe(401);
  expect((await putOds(14, { ods: [3] }, 'otro')).status).toBe(401);
  expect((await putOds(99, { ods: [3] }, TOKEN)).status).toBe(404);
  expect((await putOds(14, { ods: [0, 18] }, TOKEN)).status).toBe(400);
  expect((await putOds(14, { ods: ['3'] }, TOKEN)).status).toBe(400);
  expect((await putOds(14, 'no es json', TOKEN)).status).toBe(400);
  const del = await fetch(`${base}/api/groups/14/ods`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': TOKEN },
  });
  expect(del.status).toBe(405);
  expect((await get('/api/groups/14')).body.ods).toEqual([]);
});

test('ODS: se guardan normalizados y salen en el detalle y en el listado', async () => {
  const res = await putOds(14, { ods: [17, 3, 3, 5] }, TOKEN);
  expect(await res.json()).toEqual({ ods: [3, 5, 17] });
  expect((await get('/api/groups/14')).body.ods).toEqual([3, 5, 17]);
  expect((await get('/api/groups')).body[0].ods).toEqual([3, 5, 17]);
  // El investigador hereda los ODS de sus grupos (el 1 pertenece al grupo 14).
  expect((await get('/api/investigators/1')).body.groups[0].ods).toEqual([3, 5, 17]);
  expect(await (await putOds(14, { ods: [] }, TOKEN)).json()).toEqual({ ods: [] });
  expect((await get('/api/groups/14')).body.ods).toEqual([]);
});
