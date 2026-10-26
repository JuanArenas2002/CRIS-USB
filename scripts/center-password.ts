// Contraseñas de centro para las fotos de proyectos (/admin/proyectos/fotos): las asigna el admin
// general en /admin/centros y las usan los directores. Solo se guarda "sal:hash" (scrypt).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const MIN_CENTER_PASSWORD = 8;
const HASH = /^[0-9a-f]{32}:[0-9a-f]{128}$/;

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored || !HASH.test(stored)) return false;
  const [salt, hash] = stored.split(':') as [string, string];
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'));
}

/** Para el MapStore: solo hashes bien formados. */
export const normalizePasswordHash = (v: unknown): string | null =>
  typeof v === 'string' && HASH.test(v) ? v : null;
