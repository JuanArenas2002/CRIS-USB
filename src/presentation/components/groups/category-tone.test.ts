import { categoryTone } from './category-tone';

test('categoría: A1 la más oscura y cada inferior más clara; sin categoría, neutro', () => {
  const bg = (c: string | null) => /bg-\[#([0-9A-F]{6})\]/i.exec(categoryTone(c))?.[1];
  const lum = (hex: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const scale = ['A1', 'A', 'B', 'C', 'D', 'Reconocido'].map((c) => lum(bg(c)!));
  expect(scale).toEqual([...scale].sort((a, b) => a - b));
  expect(categoryTone(' a1 ')).toBe(categoryTone('A1'));
  expect(categoryTone(null)).toContain('bg-surface-cream-alt');
});
