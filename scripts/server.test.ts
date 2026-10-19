// @vitest-environment node
import fs from 'node:fs';
import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { createSiteServer } from './server';

let dir = '';
let base = '';
let server: http.Server;
beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cris-dist-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>inicio</h1>');
  fs.writeFileSync(path.join(dir, '404.html'), '<h1>no encontrado</h1>');
  fs.mkdirSync(path.join(dir, 'grupos/1-uno'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'grupos/1-uno/index.html'), '<h1>grupo</h1>');
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets/index-AbCdEf12.js'), 'console.log(1)'.repeat(50));
  fs.writeFileSync(path.join(os.tmpdir(), 'secreto-cris.txt'), 'no');
  server = createSiteServer({
    staticDir: dir,
    api: (_req, res) => res.end('{"api":true}'),
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const get = async (p: string, headers: Record<string, string> = {}) => {
  const res = await fetch(base + p, { headers });
  return { status: res.status, text: await res.text(), headers: res.headers };
};

test('páginas prerenderizadas con o sin "/" final, /api al BFF', async () => {
  expect((await get('/')).text).toBe('<h1>inicio</h1>');
  expect((await get('/grupos/1-uno')).text).toBe('<h1>grupo</h1>');
  expect((await get('/grupos/1-uno/?tab=integrantes')).text).toBe('<h1>grupo</h1>');
  expect((await get('/api/groups')).text).toBe('{"api":true}');
});

test('/admin lo resuelve la app; lo demás es 404 con su página', async () => {
  expect((await get('/admin/ods')).text).toBe('<h1>inicio</h1>');
  const nf = await get('/no-existe');
  expect(nf.status).toBe(404);
  expect(nf.text).toBe('<h1>no encontrado</h1>');
});

test('no sale de la carpeta publicada', async () => {
  const r = await get('/..%2fsecreto-cris.txt');
  expect(r.status).toBe(404);
  expect(r.text).not.toBe('no');
});

test('assets con hash inmutables y comprimidos; HTML se revalida', async () => {
  const js = await get('/assets/index-AbCdEf12.js', { 'Accept-Encoding': 'gzip' });
  expect(js.headers.get('cache-control')).toContain('immutable');
  expect(js.headers.get('content-encoding')).toBe('gzip');
  expect((await get('/')).headers.get('cache-control')).toBe('no-cache');
});
