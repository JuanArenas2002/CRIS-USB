import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
// Como en Chrome reciente: scrollTo devuelve una Promise (un efecto que la retorne rompe el árbol).
if (typeof window !== 'undefined') window.scrollTo = (() => Promise.resolve()) as typeof window.scrollTo;
