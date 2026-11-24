// Sesión de administración: POST valida el token una vez y deja la cookie; GET la comprueba; DELETE la cierra.
import {
  ADMIN_SESSION_SECONDS,
  adminCookie,
  issueAdminSession,
  sameSecret,
  validAdminSession,
} from '../admin-auth.ts';
import { MAX_JSON_BYTES, readBody } from '../http.ts';
import type { RequestContext, Route } from '../router.ts';

type Action = (rc: RequestContext, adminToken: string) => unknown;

const check: Action = ({ req, send }, adminToken) => {
  const ok = validAdminSession(req, adminToken);
  return send(ok ? 200 : 401, ok ? { ok } : { detail: 'Sin sesión de administración' });
};

const close: Action = ({ req, res, send }) => {
  res.setHeader('Set-Cookie', adminCookie(req, '', 0));
  return send(200, { ok: true });
};

/** El token del cuerpo; un cuerpo inválido (o que excede el tope) cuenta como vacío. */
function tokenOf(body: Buffer | null) {
  try {
    return String((JSON.parse(body?.toString() ?? '{}') as { token?: unknown }).token ?? '');
  } catch {
    return '';
  }
}

const open: Action = async ({ req, res, send }, adminToken) => {
  const token = tokenOf(await readBody(req, MAX_JSON_BYTES));
  if (!token || !sameSecret(token, adminToken))
    return send(401, { detail: 'Token de administración inválido' });
  res.setHeader('Set-Cookie', adminCookie(req, issueAdminSession(adminToken), ADMIN_SESSION_SECONDS));
  return send(200, { ok: true });
};

const ACTIONS = new Map<string, Action>([
  ['GET', check],
  ['DELETE', close],
  ['POST', open],
]);

export const adminSessionRoute: Route = {
  match: /^\/api\/admin\/session$/,
  handler(rc) {
    const { adminToken } = rc.ctx;
    if (!adminToken) return rc.send(503, { detail: 'Administración deshabilitada (falta CRIS_ADMIN_TOKEN)' });
    const action = ACTIONS.get(rc.req.method ?? '');
    return action ? action(rc, adminToken) : rc.send(405, { detail: 'Método no permitido' });
  },
};
