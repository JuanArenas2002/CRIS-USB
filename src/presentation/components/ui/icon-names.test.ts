// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';

// La fuente de iconos se pide solo con los nombres de `icon_names` (index.html): un nombre que
// falte se ve como texto («VISIBILITY»). Esta prueba revisa que todo icono usado esté en la lista.
const files = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );

test('todo icono usado en el código está en icon_names de index.html', () => {
  const loaded = new Set(/icon_names=([^&]+)/.exec(fs.readFileSync('index.html', 'utf8'))![1]!.split(','));
  const used = new Set<string>();
  for (const f of files('src')) {
    const src = fs.readFileSync(f, 'utf8');
    // <Icon name="x">, icon="x", icon: 'x' y nombres dentro de name={cond ? 'a' : 'b'}.
    for (const m of src.matchAll(
      /(?:<Icon[^>]*?\bname=|\bicon=|\bicon: )(?:\{([^}]*)\}|(['"])([a-z0-9_]+)\2)/g,
    )) {
      if (m[3]) used.add(m[3]);
      for (const q of (m[1] ?? '').matchAll(/['"]([a-z0-9_]+)['"]/g)) used.add(q[1]!);
    }
  }
  expect([...used].filter((n) => !loaded.has(n))).toEqual([]);
});
