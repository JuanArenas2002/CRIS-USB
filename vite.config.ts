import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { createPublicApi } from './scripts/public-api.ts';

/** /api público (BFF) en dev y preview; en preview además sirve las páginas prerenderizadas sin "/" final. */
function publicApi(env: Record<string, string>): Plugin {
  const handler = createPublicApi({
    metrikUrl: env.CRIS_METRIK_URL || undefined,
    photosDir: env.CRIS_PHOTOS_DIR || undefined,
    odsFile: env.CRIS_ODS_FILE || undefined,
    adminToken: env.CRIS_ADMIN_TOKEN || undefined,
  });
  return {
    name: 'cris-public-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer(server) {
      server.middlewares.use(handler);
      server.middlewares.use((req, _res, next) => {
        // Equivale a `try_files $uri $uri/index.html` de nginx.
        if (req.url && /^\/(investigadores|grupos)\/[^/?.]+(\?|$)/.test(req.url))
          req.url = req.url.replace(/^([^?]+)/, '$1/');
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // CRIS_* (no VITE_*) → solo en Node, nunca llega al bundle del navegador.
  const env = loadEnv(mode, process.cwd(), 'CRIS_');
  return {
    plugins: [react(), tailwindcss(), publicApi(env)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
