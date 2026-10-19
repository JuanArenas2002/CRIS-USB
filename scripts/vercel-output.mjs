// Último paso de `npm run build` en Vercel (VERCEL=1): arma `.vercel/output` (Build Output API v3)
// con las páginas prerenderizadas de dist/ y el BFF como función de Node. Fuera de Vercel no hace nada.
// https://vercel.com/docs/build-output-api/v3
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';

if (!process.env.VERCEL && !process.argv.includes('--force')) process.exit(0);

const out = path.resolve('.vercel/output');
const fn = path.join(out, 'functions/api.func');
await fs.rm(out, { recursive: true, force: true });

// 1. Estáticos: lo que generó el prerender.
await fs.cp(path.resolve('dist'), path.join(out, 'static'), { recursive: true });

// 2. BFF en un solo archivo (dependencias incluidas): sin node_modules ni imports .ts en la función.
await build({
  configFile: false,
  publicDir: false,
  logLevel: 'warn',
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: path.resolve('scripts/vercel-api.ts'),
    outDir: fn,
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: { output: { format: 'es', entryFileNames: 'index.mjs', codeSplitting: false } },
  },
});
await fs.writeFile(
  path.join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      // La primera consulta en frío trae todos los grupos de Metri-K (~100 llamadas, en paralelo).
      maxDuration: 60,
    },
    null,
    2,
  ),
);
await fs.writeFile(path.join(fn, 'package.json'), JSON.stringify({ type: 'module' }));

// 3. Rutas: primero archivos reales (páginas prerenderizadas, assets); /api → función;
//    /admin/* → la app (no se prerenderiza); lo demás → 404 con la página de "no encontrado".
await fs.writeFile(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api/(.*)$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '^/admin(?:/.*)?$', dest: '/index.html' },
        { src: '^/(.*)$', dest: '/404.html', status: 404 },
      ],
    },
    null,
    2,
  ),
);
console.log('Vercel: .vercel/output listo (estáticos + función /api).');
