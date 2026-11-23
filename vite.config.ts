import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { createPublicApi } from './scripts/public-api.ts';
import { storeOptionsFromEnv } from './scripts/stores.ts';

/** /api público (BFF) en dev y preview; en preview además sirve las páginas prerenderizadas sin "/" final. */
function publicApi(env: Record<string, string>): Plugin {
  const handler = createPublicApi({
    metrikUrl: env.CRIS_METRIK_URL || undefined,
    collabUrl: env.CRIS_COLLAB_URL || undefined,
    orcidUrl: env.CRIS_ORCID_URL || undefined,
    adminToken: env.CRIS_ADMIN_TOKEN || undefined,
    ...storeOptionsFromEnv(env),
  });
  return {
    name: 'cris-public-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer(server) {
      server.middlewares.use(handler);
      server.middlewares.use((req, _res, next) => {
        // Equivale a `try_files $uri $uri/index.html` de nginx.
        if (req.url && /^\/(investigadores|grupos|centros)\/[^/?.]+(\?|$)/.test(req.url))
          req.url = req.url.replace(/^([^?]+)/, '$1/');
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // CRIS_* y BLOB_* (no VITE_*) → solo en Node, nunca llegan al bundle del navegador.
  const env = loadEnv(mode, process.cwd(), ['CRIS_', 'BLOB_']);
  // Subruta de publicación (p. ej. /investigacion detrás del proxy de metrik.unisimon.edu.co).
  const basePath = (env.CRIS_BASE_PATH ?? '').replace(/^\/*/, '/').replace(/\/+$/, '');
  // Backend de noticias (FastAPI) detrás de /news-api: mismo origen para el navegador, así la cookie de
  // sesión (HttpOnly, SameSite=Lax) viaja sin CORS. El BFF responde todo /api/*, por eso otro prefijo.
  const newsApi = {
    [`${basePath}/news-api`]: {
      target: env.CRIS_NEWS_API_URL || 'http://localhost:8005',
      rewrite: (p: string) => p.replace(new RegExp(`^${basePath}/news-api`), '/api'),
      xfwd: true, // X-Forwarded-For: IP real del lector (ver scripts/server.ts)
    },
  };
  return {
    base: `${basePath}/`,
    server: { proxy: newsApi },
    preview: { proxy: newsApi },
    plugins: [react(), tailwindcss(), publicApi(env)],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
