# Unisimón Research — Portal de investigación

Migración de `plantilla.html` a React 19 + Vite + Tailwind CSS v4. Los datos vienen de **Metri-K** (investigadores, grupos, líneas e historial de categorías) a través de un BFF que filtra los datos personales. Las páginas públicas se prerenderizan (SSG) para SEO.

## Requisitos

- Node 24+ (ejecuta los `.ts` de `scripts/` de forma nativa).
- Acceso a la API de Metri-K (`https://metrik.unisimon.edu.co/back/api`).

## Configuración

Todo se configura con variables de entorno. Copia `.env.example` a `.env` y completa los valores (cada variable está explicada ahí). `.env` no se sube a git.

| Variable                                                      | Para qué                                                                                 | Pública         |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------- |
| `VITE_SITE_URL`                                               | URL pública del portal: canónicas, Open Graph, sitemap, robots. **Se fija al compilar.** | sí              |
| `VITE_API_BASE_URL`                                           | origen de la API para el navegador (vacío = mismo dominio)                               | sí              |
| `CRIS_METRIK_URL`                                             | API de Metri-K (fuente de los datos)                                                     | no              |
| `HOST`, `PORT`                                                | dirección y puerto de `npm start` (servidor propio)                                      | no              |
| `CRIS_STATIC_DIR`                                             | carpeta del sitio compilado (`dist`)                                                     | no              |
| `CRIS_PHOTOS_DIR`                                             | carpeta de fotos (`data/photos`)                                                         | no              |
| `CRIS_ODS_FILE`                                               | archivo de ODS por grupo (`data/ods.json`)                                               | no              |
| `BLOB_READ_WRITE_TOKEN` / `BLOB_STORE_ID`, `CRIS_BLOB_ACCESS` | solo Vercel: fotos y ODS en Vercel Blob                                                  | no, secreto     |
| `CRIS_ADMIN_TOKEN`                                            | token de `/admin/fotos` y `/admin/ods`                                                   | **no, secreto** |

`VITE_*` termina en el JavaScript del navegador: nunca pongas secretos ahí.

## Scripts

```bash
npm run dev        # desarrollo: Vite + API /api en http://localhost:5173
npm run build      # typecheck + bundle cliente + bundle SSR + prerender (requiere Metri-K)
npm start          # producción en servidor propio: páginas + API en HOST:PORT
npm run preview    # vista previa de dist/ con la API (http://localhost:4173)
npm test           # Vitest
npm run typecheck  # tsc
npm run lint       # ESLint
npm run format     # Prettier
```

`npm run build` falla si Metri-K no responde: no se publica un sitio vacío.

## Despliegue

Las páginas se generan en el build con los datos de ese momento (bueno para Google) y, al abrirlas, el navegador las refresca en segundo plano desde `/api`. Aun así conviene **reconstruir periódicamente** (p. ej. cada noche) para que el HTML y el sitemap incluyan lo nuevo de Metri-K.

### A. Servidor propio (recomendado para producción)

Un solo proceso Node sirve las páginas y la API. Requiere Node 24+.

```bash
git clone https://github.com/JuanArenas2002/CRIS-USB.git && cd CRIS-USB
npm ci
cp .env.example .env       # edita VITE_SITE_URL, CRIS_ADMIN_TOKEN, HOST, PORT…
npm run build
npm start                  # → http://HOST:PORT
```

- Para que siga corriendo y arranque con el equipo usa un gestor de procesos, p. ej. `npx pm2 start npm --name cris -- start` (o un servicio de systemd / Windows).
- Fotos y ODS quedan en `CRIS_PHOTOS_DIR` y `CRIS_ODS_FILE`: **respáldalos**, no están en git.
- Para actualizar: `git pull && npm ci && npm run build` y reinicia el proceso.
- Con dominio y HTTPS, pon nginx/IIS/Apache delante con proxy de todo al `PORT` (y `HOST=127.0.0.1`):

```nginx
server {
  server_name investigacion.unisimon.edu.co;
  location / { proxy_pass http://127.0.0.1:8080; proxy_set_header Host $host; }
}
```

### B. Vercel (pruebas)

Build Command `npm run build`, Output Directory `dist`, Install Command `npm install`, Node 24. En Vercel el build genera además `.vercel/output` con la API como función. Fotos y ODS van en **Vercel Blob**: crea un store (Storage → Blob, privado) y conéctalo al proyecto. Variables: `VITE_SITE_URL` (Config), `CRIS_METRIK_URL` (Config), `CRIS_ADMIN_TOKEN` (Secret). Tras cambiar variables, haz **Redeploy**.

### C. nginx sirviendo `dist/` + API aparte

```bash
HOST=127.0.0.1 PORT=8787 node scripts/public-api.ts   # solo la API
```

```nginx
server {
  root /srv/cris-unisimon/dist;
  location /api/ { proxy_pass http://127.0.0.1:8787; }
  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
  location /admin/ { try_files /index.html =404; }
  location / { try_files $uri $uri/index.html =404; }
  error_page 404 /404.html;
}
```

## Fotos y ODS (temporal, hasta que Metri-K los tenga)

Se asignan en las vistas ocultas **`/admin/fotos`**, **`/admin/ods`** y **`/admin/centros`** (logo y página oficial de cada centro: `CRIS_LOGOS_DIR`, `CRIS_CENTER_SITES_FILE`; por defecto `data/logos` y `data/center-sites.json`) con `CRIS_ADMIN_TOKEN`. Se guardan en disco (`CRIS_PHOTOS_DIR`, `CRIS_ODS_FILE`) o, en Vercel, en Vercel Blob. Las sirve la API (`/api/investigators/{id}/photo`, `ods` en cada grupo) y aparecen al instante.

## SEO

- `robots.txt`, `sitemap.xml` y `llms.txt` se generan en el build con `VITE_SITE_URL`.
- Datos estructurados: `ProfilePage` en investigadores, `Organization` en grupos y en la portada, `BreadcrumbList` en ambos. Compruébalos con la [prueba de resultados enriquecidos](https://search.google.com/test/rich-results) usando la URL de un perfil.
- Para indexar: registra el sitio en Google Search Console y envía `sitemap.xml`.

Más detalles: [ARCHITECTURE.md](ARCHITECTURE.md).
