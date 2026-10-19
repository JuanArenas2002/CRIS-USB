import type { z } from 'zod';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function messageFor(status: number): string {
  if (status === 401 || status === 403) return 'El servicio de datos rechazó la solicitud (credenciales).';
  if (status === 404) return 'El recurso no existe.';
  if (status === 429) return 'Demasiadas solicitudes. Intenta de nuevo en un momento.';
  if (status >= 500) return 'El servicio de datos tuvo un problema. Intenta de nuevo.';
  return `Error inesperado (${status}).`;
}

export interface ApiClientOptions {
  /** '' en el navegador (proxy same-origin); URL absoluta en Node (prerender). */
  baseUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export type ApiGet = <T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) => Promise<T>;

export function createApiClient({
  baseUrl = '',
  headers = {},
  timeoutMs = 15_000,
}: ApiClientOptions = {}): ApiGet {
  return async (path, schema, signal) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        headers: { Accept: 'application/json', ...headers },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      if (signal?.aborted) throw err; // cancelación del llamador: no es un error de red
      throw new ApiError(
        0,
        timeout.aborted
          ? 'El servicio de datos tardó demasiado en responder.'
          : 'No se pudo conectar con el servicio de datos.',
      );
    }
    if (!res.ok) throw new ApiError(res.status, messageFor(res.status));
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) {
      console.error(`Contrato de API roto en ${path}`, parsed.error.issues);
      throw new ApiError(res.status, 'El servicio de datos respondió con un formato inesperado.');
    }
    return parsed.data;
  };
}
