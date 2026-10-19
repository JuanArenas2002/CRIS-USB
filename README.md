# Unisimón Research — Portal de investigación

Migración de `plantilla.html` a React 19 + Vite + Tailwind CSS v4. Los datos vienen de **Metri-K** (investigadores, grupos, líneas e historial de categorías) a través de un BFF que filtra los datos personales. Las páginas públicas se prerenderizan (SSG) para SEO.

## Requisitos

- Node 24+ (ejecuta los `.ts` de `scripts/` de forma nativa).
- Acceso a la API de Metri-K (`https://metrik.unisimon.edu.co/back/api`).

## Configuración

Copia `.env.example` a `.env`:

| Variable | Dónde se usa | Pública |
| --- | --- | --- |
| `VITE_SITE_URL` | canónicas, Open Graph, sitemap | sí (va al bundle) |
| `CRIS_METRIK_URL` | BFF y prerender (Node) | no |
| `VITE_API_BASE_URL` | origen del BFF para el navegador (vacío = mismo origen) | sí |
| `CRIS_PHOTOS_DIR` | carpeta donde el BFF guarda las fotos (`data/photos`) | no |
| `CRIS_ADMIN_TOKEN` | token de la vista oculta `/admin/fotos`; sin él, no se pueden cambiar fotos | **no, secreto** |

## Scripts

```bash
npm run dev        # Vite + BFF /api en http://localhost:5173
npm run build      # typecheck + bundle cliente + bundle SSR + prerender (requiere Metri-K)
npm run build:spa  # solo bundle cliente, sin prerender (no apto para SEO)
npm run preview    # sirve dist/ + BFF, como en producción
npm test           # Vitest
npm run typecheck  # tsc
npm run lint       # ESLint
npm run format     # Prettier
```

`npm run build` falla si Metri-K no responde: no se publica un sitio vacío. Hace unas 700 peticiones (grupos, líneas, historial y grupos de cada investigador), 6 a la vez.

## Despliegue

`dist/` es estático. Hay que **reconstruir periódicamente** (p. ej. cron nocturno) para que los cambios de Metri-K lleguen al HTML y al sitemap. Entre builds, una URL nueva se renderiza en el cliente vía `404.html`.

El navegador solo habla con el BFF (`scripts/public-api.ts`), nunca con Metri-K:

```bash
CRIS_METRIK_URL=https://metrik.unisimon.edu.co/back/api PORT=8787 node scripts/public-api.ts
```

```nginx
server {
  root /srv/cris-unisimon/dist;
  location /api/ { proxy_pass http://127.0.0.1:8787; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location / { try_files $uri $uri/index.html =404; }
  error_page 404 /404.html;
}
```

### Fotos de investigadores (temporal)

Metri-K no aloja fotos, así que el portal las guarda en `CRIS_PHOTOS_DIR` (un `.webp` por investigador) y las sirve en `/api/investigators/{id}/photo`. Se asignan en la vista oculta **`/admin/fotos`** con el token `CRIS_ADMIN_TOKEN`. **Respalda esa carpeta**: no está en git. Las fotos nuevas llegan al HTML prerenderizado en el siguiente `npm run build`.

Más detalles: [ARCHITECTURE.md](ARCHITECTURE.md).
