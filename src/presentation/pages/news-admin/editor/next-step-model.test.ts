import type { News } from '@/infrastructure/news/news-api';
import { EDITABLE_STATUSES, isBlocked, isExpired, stageOf, stageText } from './next-step-model';

const news = (status: string, over: Partial<News> = {}) =>
  ({
    id: 1,
    slug: 's',
    status,
    start_at: '2026-12-01T10:00:00Z',
    end_at: null,
    published_at: '2026-11-03T10:00:00Z',
    ...over,
  }) as unknown as News;
const can =
  (...codes: string[]) =>
  (code: string) =>
    codes.includes(code);

test('etapa: nueva y rechazada son borrador; programada y publicada comparten etapa', () => {
  expect(stageOf(undefined)).toBe('draft');
  expect(stageOf(news('draft'))).toBe('draft');
  expect(stageOf(news('rejected'))).toBe('draft');
  expect(stageOf(news('in_review'))).toBe('in_review');
  expect(stageOf(news('approved'))).toBe('approved');
  expect(stageOf(news('scheduled'))).toBe('live');
  expect(stageOf(news('published'))).toBe('live');
  expect(stageOf(news('archived'))).toBe('archived');
  expect(stageOf(news('algo-nuevo'))).toBe('archived'); // un estado desconocido no ofrece acciones
});

test('bloqueo: solo importa lo que falta mientras la noticia aún se edita', () => {
  expect([...EDITABLE_STATUSES].sort()).toEqual(['draft', 'rejected']);
  expect(isBlocked([], undefined)).toBe(false);
  expect(isBlocked(['el título'], undefined)).toBe(true);
  expect(isBlocked(['el título'], news('rejected'))).toBe(true);
  expect(isBlocked(['el título'], news('published'))).toBe(false); // ya no se edita: nada impide curar
});

test('vencida: fecha de fin ya pasada', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  expect(isExpired({ end_at: null }, now)).toBe(false);
  expect(isExpired({ end_at: '2026-11-19T00:00:00Z' }, now)).toBe(true);
  expect(isExpired({ end_at: '2026-11-21T00:00:00Z' }, now)).toBe(false);
});

test('texto: depende de la etapa y de los permisos', () => {
  expect(stageText(undefined, can())).toMatch(/guárdala como borrador/);
  expect(stageText(news('draft'), can())).toMatch(/envíala a revisión/);
  expect(stageText(news('in_review'), can('news.review'))).toMatch(/Revisa el contenido/);
  expect(stageText(news('in_review'), can('news.approve'))).toMatch(/Revisa el contenido/);
  expect(stageText(news('in_review'), can())).toMatch(/Esperando que un revisor/);
  expect(stageText(news('approved'), can('news.publish'))).toMatch(/Publícala ahora/);
  expect(stageText(news('approved'), can())).toBe('Aprobada: esperando publicación.');
  expect(stageText(news('archived'), can())).toMatch(/^Archivada/);
  expect(stageText(news('scheduled'), can())).toMatch(/Se publicará automáticamente el/);
  const now = new Date('2026-11-20T00:00:00Z');
  expect(stageText(news('published', { end_at: '2020-01-01T00:00:00Z' }), can(), now)).toMatch(/^Vencida el/);
  expect(stageText(news('published'), can(), now)).toMatch(/^Visible en el portal desde [^h]*\.$/);
  expect(stageText(news('published', { end_at: '2099-01-01T00:00:00Z' }), can(), now)).toMatch(/ hasta /);
});
