// Función de Vercel con el BFF completo (/api/...). scripts/vercel-output.mjs la empaqueta en un solo
// archivo; Vercel la invoca con (req, res) de Node y la URL original de la petición.
import { createPublicApi } from './public-api.ts';
import { storeOptionsFromEnv } from './stores.ts';

export default createPublicApi({
  metrikUrl: process.env.CRIS_METRIK_URL || undefined,
  adminToken: process.env.CRIS_ADMIN_TOKEN || undefined,
  ...storeOptionsFromEnv(process.env),
});
