export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');
export const SITE_NAME = 'Unisimón Research';
export const ORGANIZATION = {
  '@type': 'CollegeOrUniversity',
  name: 'Universidad Simón Bolívar',
  url: 'https://www.unisimon.edu.co',
} as const;

export interface PageMeta {
  title: string;
  description: string;
  /** Ruta canónica, p. ej. `/investigadores/12-ana-perez`. */
  path: string;
  noindex?: boolean;
  type?: 'website' | 'profile';
  /** Ruta de la imagen para redes sociales; por defecto, el logo. */
  image?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const absoluteUrl = (path: string) => SITE_URL + path;

export function fullTitle(title: string): string {
  return title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
}

/** Etiquetas de <head> por página. Las mismas sirven al prerender (string) y al cliente. */
export function headTags(meta: PageMeta): string {
  const url = absoluteUrl(meta.path);
  const tags = [
    `<meta name="description" content="${esc(meta.description)}">`,
    `<meta name="robots" content="${meta.noindex ? 'noindex, follow' : 'index, follow'}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="${meta.type ?? 'website'}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:locale" content="es_CO">`,
    `<meta property="og:title" content="${esc(fullTitle(meta.title))}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(absoluteUrl(meta.image ?? '/assets/unisimon-logo.png'))}">`,
    `<meta name="twitter:card" content="summary">`,
  ];
  return tags.map((t) => t.replace(/^<(\w+)/, '<$1 data-seo')).join('\n    ');
}

export function titleTag(meta: PageMeta): string {
  return `<title>${esc(fullTitle(meta.title))}</title>`;
}

/** Cliente: reemplaza las etiquetas de la página anterior. */
export function applyHead(meta: PageMeta): void {
  document.title = fullTitle(meta.title);
  document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
  document.head.insertAdjacentHTML('beforeend', headTags(meta));
}

/** JSON seguro dentro de <script>: evita que un `</script>` en los datos cierre la etiqueta. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
