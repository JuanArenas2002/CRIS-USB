// Servidor de producción propio (sin Vercel ni nginx obligatorio): `npm run build && npm start`.
// Sirve las páginas prerenderizadas de dist/ y el BFF (/api) en un solo proceso Node.
// Todo se configura con variables de entorno (.env, ver .env.example):
//   HOST, PORT, CRIS_STATIC_DIR, CRIS_METRIK_URL, CRIS_ADMIN_TOKEN, CRIS_PHOTOS_DIR, CRIS_ODS_FILE,
//   BLOB_* (opcional, Vercel Blob en vez de disco).
// Detrás de nginx/IIS/Apache también funciona: basta con hacer proxy de todo al PORT.
import fs from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { createPublicApi } from './public-api.ts';
import { storeOptionsFromEnv } from './stores.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = /\.(html|js|css|json|xml|txt|svg)$/;

/** Carga .env si existe (las variables del sistema tienen prioridad). */
function loadDotEnv(file = '.env') {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith('#')) continue;
    const value = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]!] === undefined) process.env[m[1]!] = value;
  }
}

/** Equivale a `try_files $uri $uri/index.html $uri.html` de nginx, sin salir de la carpeta. */
function resolveStatic(root: string, urlPath: string): string | null {
  let rel: string;
  try {
    rel = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const base = path.resolve(root, '.' + path.posix.normalize(rel));
  if (base !== root && !base.startsWith(root + path.sep)) return null; // ../ fuera de dist
  for (const candidate of [base, path.join(base, 'index.html'), base + '.html']) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

export function createSiteServer({
  staticDir,
  api,
}: {
  staticDir: string;
  api: (req: IncomingMessage, res: ServerResponse, next?: () => void) => unknown;
}) {
  const root = path.resolve(staticDir);
  if (!fs.existsSync(path.join(root, 'index.html')))
    throw new Error(`No existe ${root}/index.html: ejecuta primero "npm run build".`);

  function sendFile(req: IncomingMessage, res: ServerResponse, file: string, status = 200) {
    const ext = path.extname(file).toLowerCase();
    res.statusCode = status;
    res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Archivos con hash de Vite: inmutables. HTML y demás: se revalidan en cada visita.
    const hashed = /[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(file);
    res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (req.method === 'HEAD') return res.end();
    const gzip = COMPRESSIBLE.test(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    if (gzip) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
    } else fs.createReadStream(file).pipe(res);
  }

  return http.createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) return void api(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      return res.end();
    }
    const file = resolveStatic(root, pathname);
    if (file) return sendFile(req, res, file);
    // Vistas que no se prerenderizan (admin): la app las resuelve en el navegador.
    if (/^\/admin(\/|$)/.test(pathname)) return sendFile(req, res, path.join(root, 'index.html'));
    const notFound = path.join(root, '404.html');
    return sendFile(req, res, fs.existsSync(notFound) ? notFound : path.join(root, 'index.html'), 404);
  });
}

if (import.meta.main) {
  loadDotEnv();
  const env = process.env;
  const host = env.HOST || '0.0.0.0';
  const port = Number(env.PORT) || 8080;
  const api = createPublicApi({
    metrikUrl: env.CRIS_METRIK_URL || undefined,
    adminToken: env.CRIS_ADMIN_TOKEN || undefined,
    ...storeOptionsFromEnv(env),
  });
  createSiteServer({ staticDir: env.CRIS_STATIC_DIR || 'dist', api }).listen(port, host, () => {
    console.log(`CRIS Unisimón en http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`  Datos: ${env.CRIS_METRIK_URL || 'Metri-K (por defecto)'}`);
    console.log(
      `  Fotos/ODS: ${env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID ? 'Vercel Blob' : `${env.CRIS_PHOTOS_DIR || 'data/photos'} · ${env.CRIS_ODS_FILE || 'data/ods.json'}`}`,
    );
    if (!env.CRIS_ADMIN_TOKEN) console.log('  Aviso: sin CRIS_ADMIN_TOKEN, /admin no puede guardar.');
  });
}
