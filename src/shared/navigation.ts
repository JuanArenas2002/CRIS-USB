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
  { key: 'authors', to: '/', ready: true },
  { key: 'projects', to: '/proyectos', ready: false },
  { key: 'products', to: '/productos', ready: true },
  { key: 'relations', to: '/relacionamiento', ready: false },
];

/** "Investigadores" vive en "/" y en los perfiles /investigadores/*. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/' || pathname.startsWith('/investigadores');
  return pathname === item.to || pathname.startsWith(item.to + '/');
}
