import type { IncomingMessage, ServerResponse } from 'node:http';
import { gzipSync } from 'node:zlib';

export const MAX_JSON_BYTES = 1024;
// ~300 filas × ~100 bytes; holgura para miles.
export const MAX_RANKING_BYTES = 1024 * 1024;
export const MAX_PAGE_SIZE = 100;
// ~1200 publicaciones con resumen ≈ 2,5 MB (2.300 ≈ 5 MB): holgura para crecer. Vercel solo admite 4,5 MB; el servidor propio no.
export const MAX_PUBLICATIONS_BYTES = 16 * 1024 * 1024;

/** `privateBody`: respuesta del admin (con token) que ningún CDN ni navegador debe guardar. */
export type Send = (status: number, body: unknown, privateBody?: boolean) => void;

/** Cuerpo de la petición; `null` si supera `max` bytes. */
export async function readBody(req: IncomingMessage, max: number): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) return null;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Un campo del cuerpo JSON. `null` si el cuerpo excedió el tope (ver `readBody`); `onInvalid` si no es JSON o
 * `pick` falla (p. ej. el JSON es `null`). Cada ruta decide qué significa una u otra.
 */
export function readField(
  body: Buffer | null,
  pick: (json: Record<string, unknown>) => unknown,
  onInvalid: unknown,
): unknown {
  try {
    return body && pick(JSON.parse(body.toString('utf8')) as Record<string, unknown>);
  } catch {
    return onInvalid;
  }
}

/** Un campo del cuerpo JSON, sin confundir los tres casos que `readField` junta en `undefined`. */
export type JsonField =
  | { kind: 'invalid' } // no es JSON, o no es un objeto
  | { kind: 'absent' } // objeto sin ese campo
  | { kind: 'value'; value: unknown }; // el campo está, incluso si vale `null`

/** El cuerpo ya está leído (no excede el tope): separa «inválido», «ausente» y «presente» (incluido `null`). */
export function jsonField(body: Buffer, key: string): JsonField {
  let json: unknown;
  try {
    json = JSON.parse(body.toString('utf8'));
  } catch {
    return { kind: 'invalid' };
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return { kind: 'invalid' };
  return Object.hasOwn(json, key)
    ? { kind: 'value', value: (json as Record<string, unknown>)[key] }
    : { kind: 'absent' };
}

/** 413: un cuerpo que supera el tope nunca se interpreta como contenido; la ruta no ejecuta ninguna operación. */
export const tooLarge = (send: Send, limit: string) => send(413, { detail: `La solicitud supera ${limit}` });

/** `page` y `size` del querystring: enteros ≥ 1, con `size` acotado a `MAX_PAGE_SIZE`. */
export function pageParams(sp: URLSearchParams, defaultSize: number) {
  const page = Number(sp.get('page')) || 1;
  const size = Number(sp.get('size')) || defaultSize;
  return {
    page: Math.max(1, Math.floor(page)),
    pageSize: Math.min(Math.max(1, Math.floor(size)), MAX_PAGE_SIZE),
  };
}

/** Responde JSON; el gzip propio solo aplica con `compress` (servidor propio: Vercel y Vite ya tienen su capa). */
export function createSend(req: IncomingMessage, res: ServerResponse, compress: boolean): Send {
  return function send(status, body, privateBody = false) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // El navegador siempre revalida; el CDN (Vercel) guarda 30 s. Así lo que cambie el admin
    // (fotos, ODS) se ve en menos de un minuto sin consultar Metri-K en cada visita.
    res.setHeader(
      'Cache-Control',
      status === 200 && !privateBody
        ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=60'
        : 'no-store',
    );
    const json = JSON.stringify(body);
    // JSON comprimido (los listados pesan decenas de KB); los pequeños no compensan.
    if (compress && json.length > 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      return void res.end(gzipSync(json));
    }
    res.end(json);
  };
}

/**
 * Persistir con su propio mensaje de error: si `save` falla responde 500 `«{failure}: {motivo}»` y devuelve
 * `null`. El mecanismo es común; el mensaje y el código de cada ruta no cambian.
 */
export async function saveOr500<T>(
  send: Send,
  failure: string,
  save: () => Promise<T>,
): Promise<{ value: T } | null> {
  try {
    return { value: await save() };
  } catch (err) {
    send(500, { detail: `${failure}: ${(err as Error).message}` });
    return null;
  }
}
