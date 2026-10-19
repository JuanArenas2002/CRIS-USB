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
// Como en Chrome reciente: scrollTo devuelve una Promise (un efecto que la retorne rompe el árbol).
if (typeof window !== 'undefined') window.scrollTo = (() => Promise.resolve()) as typeof window.scrollTo;
