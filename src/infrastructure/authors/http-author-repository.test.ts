import { afterEach, vi } from 'vitest';
import { ApiError, createApiClient } from '@/infrastructure/http/api-client';
import { makeAuthor } from '@/test-utils';
import { httpAuthorRepository } from './http-author-repository';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const repo = () => httpAuthorRepository(createApiClient({ baseUrl: 'http://bff' }));
const { groups: _groups, production: _production, ...author } = makeAuthor();

test('list: arma los parámetros del BFF y valida la respuesta', async () => {
  const fetch = mockFetch(200, { items: [author], total: 1, page: 2, pages: 1 });
  const page = await repo().list({
    search: 'ana',
    category: 'senior',
    englishLevel: 'B2',
    groupId: 9,
    page: 2,
    pageSize: 12,
  });
  const [url] = fetch.mock.calls[0] as unknown as [string];
  expect(url).toBe('http://bff/api/investigators?page=2&size=12&q=ana&cat=senior&en=B2&group=9');
  expect(page.items[0]).toEqual(author);
});

test('getById: 404 → null; 502 → ApiError', async () => {
  mockFetch(404, { detail: 'No encontrado' });
  expect(await repo().getById(1)).toBeNull();
  mockFetch(502, { detail: 'Servicio de datos no disponible' });
  await expect(repo().getById(1)).rejects.toMatchObject({ name: 'ApiError', status: 502 });
});

test('contrato roto → ApiError legible, no datos a medias', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockFetch(200, { total: 'muchos' });
  await expect(repo().stats()).rejects.toBeInstanceOf(ApiError);
});

test('red caída → ApiError status 0', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
  );
  await expect(repo().stats()).rejects.toMatchObject({ status: 0 });
});
