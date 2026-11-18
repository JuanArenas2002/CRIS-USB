import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import i18n, { DEFAULT_LANGUAGE } from '@/i18n';

afterEach(cleanup);
// jsdom anuncia navigator.language = 'en-US': cada test parte en español y sin preferencia guardada.
beforeEach(async () => {
  globalThis.localStorage?.clear();
  await i18n.changeLanguage(DEFAULT_LANGUAGE);
});
// ProseMirror/TipTap usa APIs de geometría que jsdom no expone; las dejamos vacías para que no falle el editor de noticias en tests.
if (typeof window !== 'undefined') {
  const emptyRect = () => new DOMRect(0, 0, 0, 0);

  Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: emptyRect,
  });
  Object.defineProperty(SVGElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: emptyRect,
  });
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: emptyRect,
  });
  Object.defineProperty(Node.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Node.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: emptyRect,
  });
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => null,
  });
}
// Como en Chrome reciente: scrollTo devuelve una Promise (un efecto que la retorne rompe el árbol).
if (typeof window !== 'undefined') window.scrollTo = (() => Promise.resolve()) as typeof window.scrollTo;
