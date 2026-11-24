import { yearsSince } from './years';

test('yearsSince: años transcurridos; sin año conocido, null', () => {
  expect(yearsSince(2005, 2026)).toBe(21);
  expect(yearsSince(2026, 2026)).toBe(0);
  expect(yearsSince(null, 2026)).toBeNull();
  expect(yearsSince(undefined, 2026)).toBeNull();
  expect(yearsSince(2000)).toBe(new Date().getFullYear() - 2000);
});
