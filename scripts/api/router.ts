// Router del BFF: despacha cada petición a su handler con una tabla de rutas (`routes/`).
//
// Orden, igual que cuando todo vivía en un solo handler:
//   1. fuera de /api/ → `next()` (o 404 sin siguiente middleware);
//   2. /api/admin/session;
//   3. escrituras (PUT/PATCH/DELETE) y lecturas de admin (GET): método no permitido → 405, sin token
//      configurado → 503, credenciales inválidas → 401; después el handler de la ruta;
//   4. cualquier otro método que no sea GET/HEAD → 405;
//   5. rutas públicas; sin coincidencia → 404.
// Cualquier excepción que no atrape un handler responde 502 «Servicio de datos no disponible».
import type { IncomingMessage, ServerResponse } from 'node:http';
import { hasAdminCredentials } from './admin-auth.ts';
import type { ApiContext } from './context.ts';
import { createSend, type Send } from './http.ts';
import { ADMIN_ROUTES, PUBLIC_ROUTES, SESSION_ROUTE } from './routes/index.ts';

export interface RequestContext {
  ctx: ApiContext;
  req: IncomingMessage;
  res: ServerResponse;
  /** Ruta sin querystring. */
  p: string;
  sp: URLSearchParams;
  send: Send;
}

export type Handler = (rc: RequestContext, match: RegExpExecArray) => unknown;

export interface Route {
  match: RegExp;
  /** Métodos que acepta; sin indicar, cualquiera. */
  methods?: readonly string[];
  handler: Handler;
}

const WRITE_METHODS = ['PUT', 'PATCH', 'DELETE'];

function find(routes: readonly Route[], p: string, method: string) {
  for (const route of routes) {
    if (route.methods && !route.methods.includes(method)) continue;
    const match = route.match.exec(p);
    if (match) return { route, match };
  }
  return null;
}

/** Ruta de admin: sin token configurado → 503; credenciales inválidas → 401. false si ya respondió. */
function authorizeAdmin({ ctx, req, send }: RequestContext) {
  if (!ctx.adminToken) {
    send(503, { detail: 'Administración deshabilitada (falta CRIS_ADMIN_TOKEN)' });
    return false;
  }
  if (!hasAdminCredentials(req, ctx.adminToken)) {
    send(401, { detail: 'Token de administración inválido' });
    return false;
  }
  return true;
}

/** Lecturas públicas: solo GET/HEAD; sin coincidencia → 404. */
function dispatchPublic(rc: RequestContext, method: string) {
  if (method !== 'GET' && method !== 'HEAD') return rc.send(405, { detail: 'Método no permitido' });
  const hit = find(PUBLIC_ROUTES, rc.p, method);
  return hit ? hit.route.handler(rc, hit.match) : rc.send(404, { detail: 'No encontrado' });
}

async function dispatch(rc: RequestContext) {
  const { req, p, send } = rc;
  const method = req.method ?? '';

  const session = SESSION_ROUTE.match.exec(p);
  if (session) return SESSION_ROUTE.handler(rc, session);

  const admin = find(ADMIN_ROUTES, p, method);
  // Las lecturas de admin (GET) solo existen en algunas rutas; el resto de GET son públicas.
  if (WRITE_METHODS.includes(method) || (method === 'GET' && admin)) {
    if (!admin) return send(405, { detail: 'Método no permitido' });
    return authorizeAdmin(rc) ? admin.route.handler(rc, admin.match) : undefined;
  }
  return dispatchPublic(rc, method);
}

export function createApiHandler(ctx: ApiContext) {
  return async function handler(req: IncomingMessage, res: ServerResponse, next?: () => void) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = createSend(req, res, ctx.compress);
    if (!url.pathname.startsWith('/api/')) return next ? next() : send(404, { detail: 'No encontrado' });
    try {
      await dispatch({ ctx, req, res, p: url.pathname, sp: url.searchParams, send });
    } catch {
      return send(502, { detail: 'Servicio de datos no disponible' });
    }
  };
}
