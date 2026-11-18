import { withBase } from '@/shared/base';

/**
 * Sesión de las vistas ocultas de administración (/admin/fotos, /admin/centros, /admin/ranking…).
 * El token se envía UNA vez al BFF, que responde con una cookie HttpOnly + SameSite=Strict (firmada, 8 h):
 * el navegador nunca guarda el token, así que un XSS no puede leerlo. Las peticiones de administración son
 * del mismo origen, por eso la cookie viaja sola.
 */
const SESSION_PATH = withBase('/api/admin/session');

/** Marcador NO secreto que usan las páginas para saber que hay sesión (no es el token). */
export const ADMIN_SESSION = 'session';

/** Cabeceras de autenticación: con sesión por cookie no hace falta ninguna. */
export const adminHeaders = (token: string): Record<string, string> =>
  token && token !== ADMIN_SESSION ? { 'X-Admin-Token': token } : {};

export async function hasAdminSession(): Promise<boolean> {
  try {
    return (await fetch(SESSION_PATH, { credentials: 'same-origin' })).ok;
  } catch {
    return false;
  }
}

/** true si el servidor aceptó el token y dejó la cookie de sesión. */
export async function startAdminSession(token: string): Promise<boolean> {
  try {
    const res = await fetch(SESSION_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function endAdminSession(): Promise<void> {
  await fetch(SESSION_PATH, { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined);
}
