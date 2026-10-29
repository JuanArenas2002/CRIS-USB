// Función de Vercel con el BFF completo (/api/...). scripts/vercel-output.mjs la empaqueta en un solo
// archivo; Vercel la invoca con (req, res) de Node y la URL original de la petición.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setOidcToken } from './blob-store.ts';
import { createPublicApi } from './public-api.ts';
import { storeOptionsFromEnv } from './stores.ts';

const api = createPublicApi({
  metrikUrl: process.env.CRIS_METRIK_URL || undefined,
  collabUrl: process.env.CRIS_COLLAB_URL || undefined,
  adminToken: process.env.CRIS_ADMIN_TOKEN || undefined,
  ...storeOptionsFromEnv(process.env),
  onVercel: true,
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Store de Blob conectado por OIDC: Vercel manda el token temporal del proyecto en cada petición.
  const oidc = req.headers['x-vercel-oidc-token'];
  setOidcToken(typeof oidc === 'string' ? oidc : undefined);
  return api(req, res);
}
