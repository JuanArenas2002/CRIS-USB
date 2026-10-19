export interface NavItem {
  label: string;
  to: string;
  /** false = la sección aún no tiene contenido; se muestra la página "en construcción" (noindex). */
  ready: boolean;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Grupos',
    to: '/grupos',
    ready: true,
    description: 'Grupos de investigación de la Universidad Simón Bolívar reconocidos por Minciencias.',
  },
  {
    label: 'Investigadores',
    to: '/',
    ready: true,
    description: 'Directorio de investigadores de la Universidad Simón Bolívar.',
  },
  {
    label: 'Proyectos',
    to: '/proyectos',
    ready: false,
    description: 'Proyectos de investigación de la Universidad Simón Bolívar.',
  },
  {
    label: 'Productos',
    to: '/productos',
    ready: false,
    description: 'Productos de investigación y producción académica de la Universidad Simón Bolívar.',
  },
  {
    label: 'Relacionamiento',
    to: '/relacionamiento',
    ready: false,
    description: 'Colaboración y relacionamiento científico de la Universidad Simón Bolívar.',
  },
];

/** "Investigadores" vive en "/" y en los perfiles /investigadores/*. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/' || pathname.startsWith('/investigadores');
  return pathname === item.to || pathname.startsWith(item.to + '/');
}
