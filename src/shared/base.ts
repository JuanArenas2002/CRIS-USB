/**
 * Prefijo del portal cuando se publica bajo una subruta (p. ej. `/investigacion`); '' en la raíz.
 * Sale de `base` de Vite (CRIS_BASE_PATH al construir): igual en el prerender y en el navegador.
 */
// En Node puro (backend, que importa el dominio) no hay `import.meta.env`: raíz.
export const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');

/** Ruta absoluta del portal con el prefijo: withBase('/api/groups') → '/investigacion/api/groups'. */
export const withBase = (path: string) => BASE + path;

/** Para URLs que pueden venir ya completas (http…) o vacías: solo prefija rutas `/…`. */
export const withBaseUrl = <T extends string | null | undefined>(url: T): T =>
  (typeof url === 'string' && url.startsWith('/') ? withBase(url) : url) as T;
