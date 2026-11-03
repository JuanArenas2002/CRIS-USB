import type es from '@/i18n/locales/es';

export interface NavItem {
  /** Clave del texto en `common:nav.items` (etiqueta y descripción traducidas). */
  key: keyof typeof es.common.nav.items;
  to: string;
  /** false = la sección aún no tiene contenido; se muestra la página "en construcción" (noindex). */
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'centers', to: '/centros', ready: true },
  { key: 'groups', to: '/grupos', ready: true },
  { key: 'authors', to: '/investigadores', ready: true },
  { key: 'projects', to: '/proyectos', ready: true },
  { key: 'products', to: '/productos', ready: true },
  { key: 'relations', to: '/relacionamiento', ready: true },
];

export function isNavActive(item: NavItem, pathname: string): boolean {
  return pathname === item.to || pathname.startsWith(item.to + '/');
}

/** Filtros del directorio (use-author-search) en la URL. */
const DIRECTORY_PARAMS = ['q', 'cat', 'grupo', 'centro', 'vista', 'page'];

export const isDirectorySearch = (search: string) => {
  const params = new URLSearchParams(search);
  return DIRECTORY_PARAMS.some((p) => params.has(p));
};
