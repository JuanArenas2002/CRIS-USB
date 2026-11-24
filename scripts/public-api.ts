// BFF público: la única puerta del navegador a Metri-K.
// - Metri-K expone datos personales (cédulas, correos, teléfonos, hashes de contraseña); aquí se
//   proyectan a campos públicos (groups-source.ts / investigators-source.ts) y nada más sale.
// - Búsqueda, filtros y paginación se resuelven en memoria: Metri-K no los ofrece.
// - Solo lectura, salvo las fotos de investigadores y los logos de centros (PUT/DELETE), la página
//   oficial de los centros (PUT), el ranking USB y el de publicaciones (PUT/DELETE), todo con token
//   de administración.
//   Los ODS de grupos y centros vienen de Metri-K.
// Dev/preview: montado como middleware en vite.config.ts.
// Producción: `node scripts/public-api.ts` detrás de nginx (ver README).
//
// Estructura (scripts/api/):
//   context.ts  configuración, almacenes y accesores de datos con caché (un `ctx` compartido)
//   router.ts   despacho y orden de validación (405 → 503 → 401), 502 genérico
//   routes/     tabla de rutas (index.ts) y un módulo de handlers por recurso
//   http.ts, admin-auth.ts, cache.ts   utilidades transversales
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createApiContext, type PublicApiOptions } from './api/context.ts';
import { createApiHandler } from './api/router.ts';
import { storeOptionsFromEnv } from './stores.ts';

export { DEFAULT_COLLAB_URL, DEFAULT_METRIK_URL } from './api/context.ts';
export { DEFAULT_PHOTOS_DIR } from './stores.ts';

export function createPublicApi(options: PublicApiOptions = {}) {
  return createApiHandler(createApiContext(options));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { CRIS_METRIK_URL, CRIS_ADMIN_TOKEN, PORT = '8787', HOST = '127.0.0.1' } = process.env;
  http
    .createServer(
      createPublicApi({
        metrikUrl: CRIS_METRIK_URL,
        adminToken: CRIS_ADMIN_TOKEN,
        ...storeOptionsFromEnv(process.env),
      }),
    )
    .listen(Number(PORT), HOST, () => console.log(`API pública en http://${HOST}:${PORT}/api/`));
}
