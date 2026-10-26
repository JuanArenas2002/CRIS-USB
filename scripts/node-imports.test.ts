// @vitest-environment node
import { execFileSync } from 'node:child_process';

// En producción el BFF corre con Node directo (sin Vite): un import de valor sin `.ts` en lo que
// carga el servidor (scripts/ y src/domain/) rompe el arranque con ERR_MODULE_NOT_FOUND.
// Vitest resuelve sin extensión, así que solo esta prueba lo detecta.
test('el BFF carga con Node puro (imports con extensión .ts)', () => {
  expect(() =>
    execFileSync(process.execPath, ['-e', "await import('./scripts/public-api.ts')"], {
      stdio: 'pipe',
      env: { ...process.env, NODE_OPTIONS: '' },
    }),
  ).not.toThrow();
}, 30_000);
