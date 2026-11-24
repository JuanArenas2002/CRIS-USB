import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/** Comparación en tiempo constante (sha256 iguala longitudes). */
export const sameSecret = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// Sesión de administración en cookie HttpOnly (el navegador nunca guarda el token: un XSS no puede leerlo).
// Valor = vencimiento + HMAC con CRIS_ADMIN_TOKEN: no contiene el secreto y cambiar el token invalida todas.
const ADMIN_COOKIE = 'cris_admin';
export const ADMIN_SESSION_SECONDS = 8 * 3600;
const signAdmin = (secret: string, exp: number) =>
  createHmac('sha256', secret).update(`cris-admin:${exp}`).digest('base64url');

export function issueAdminSession(secret: string) {
  const exp = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS;
  return `${exp}.${signAdmin(secret, exp)}`;
}

export function validAdminSession(req: IncomingMessage, secret: string) {
  const raw = /(?:^|;\s*)cris_admin=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  if (!raw) return false;
  const [e, sig = ''] = raw.split('.');
  const exp = Number(e);
  return exp > Date.now() / 1000 && sameSecret(sig, signAdmin(secret, exp));
}

export function adminCookie(req: IncomingMessage, value: string, maxAge: number) {
  const https =
    req.headers['x-forwarded-proto'] === 'https' || !!(req.socket as { encrypted?: boolean }).encrypted;
  return `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}

/** Cookie de sesión (navegador) o cabecera X-Admin-Token (scripts y herramientas de servidor). */
export function hasAdminCredentials(req: IncomingMessage, adminToken: string) {
  const token = req.headers['x-admin-token'];
  const byHeader = typeof token === 'string' && token !== '' && sameSecret(token, adminToken);
  return byHeader || validAdminSession(req, adminToken);
}
