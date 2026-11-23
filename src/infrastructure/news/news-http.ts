import { z } from 'zod';
import { ApiError } from '@/infrastructure/http/api-client';
import { BASE } from '@/shared/base';

/**
 * HTTP hacia el backend de noticias (FastAPI) detrás del proxy /news-api.
 * - La sesión es una cookie HttpOnly que pone el servidor: aquí nunca se ve ni se guarda.
 * - Cada POST/PUT/PATCH/DELETE lleva el token CSRF en `X-CSRF-Token` (lo exige el backend).
 */
export const NEWS_API = `${BASE}/news-api`;
const CSRF_COOKIES = ['__Host-csrf', 'csrf_token']; // producción | desarrollo

let csrf = ''; // en memoria; tras recargar la página se recupera de la cookie legible

export const setCsrf = (token: string) => void (csrf = token);

function csrfToken(): string {
  if (csrf) return csrf;
  for (const part of document.cookie.split('; ')) {
    const [name, ...value] = part.split('=');
    if (CSRF_COOKIES.includes(name!)) return decodeURIComponent(value.join('='));
  }
  return '';
}

type Query = Record<string, string | number | boolean | undefined | null>;

export const qs = (params: Query = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** El backend responde `{detail}` en español: se muestra tal cual. 422 de validación => texto legible. */
function detailOf(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail))
    return detail
      .map(
        (d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join('.') || 'dato'}: ${d.msg}`,
      )
      .join(' · ');
  return `Error inesperado (${status}).`;
}

export async function call<T>(
  path: string,
  schema: z.ZodType<T>,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  let res: Response;
  try {
    res = await fetch(NEWS_API + path, {
      method,
      credentials: 'include',
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken() } : {}),
      },
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor de noticias.', 'network');
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, detailOf(body, res.status));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(`Contrato roto en ${path}`, parsed.error.issues);
    throw new ApiError(res.status, 'Respuesta inesperada del servidor.', 'contract');
  }
  return parsed.data;
}

/** Cuerpo binario (p.ej. una imagen): el backend valida el tipo real por la firma de bytes. */
export async function sendRaw<T>(path: string, schema: z.ZodType<T>, method: string, file: Blob): Promise<T> {
  let res: Response;
  try {
    res = await fetch(NEWS_API + path, {
      method,
      credentials: 'include',
      body: file,
      headers: {
        Accept: 'application/json',
        'Content-Type': file.type || 'application/octet-stream',
        'X-CSRF-Token': csrfToken(),
      },
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor de noticias.', 'network');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, detailOf(body, res.status));
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(res.status, 'Respuesta inesperada del servidor.', 'contract');
  return parsed.data;
}

export const empty = z.null();
export const errorText = (err: unknown) =>
  err instanceof ApiError
    ? err.status === 429
      ? 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
      : err.message
    : 'Ocurrió un error inesperado.';
