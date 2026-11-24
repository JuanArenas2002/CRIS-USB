// Rendimiento por noticia: vistas del ranking y reglas de orden (funciones puras).
import type { RankingSort } from '@/infrastructure/news/analytics-api';

export type View = {
  key: string;
  label: string;
  sort: RankingSort;
  order: 'asc' | 'desc';
  minViews?: number;
  empty: string;
};

export const VIEWS: View[] = [
  {
    key: 'views',
    label: 'Más vistas',
    sort: 'views',
    order: 'desc',
    empty: 'Sin visualizaciones en el periodo.',
  },
  {
    key: 'shares',
    label: 'Más compartidas',
    sort: 'shares',
    order: 'desc',
    empty: 'Sin compartidos en el periodo.',
  },
  {
    key: 'avg_active',
    label: 'Mayor lectura',
    sort: 'avg_active',
    order: 'desc',
    minViews: 5,
    empty: 'Ninguna noticia alcanza la base mínima.',
  },
  {
    key: 'growth',
    label: 'Mayor crecimiento',
    sort: 'growth',
    order: 'desc',
    empty: 'Ninguna noticia creció.',
  },
  {
    key: 'low',
    label: 'Bajo rendimiento',
    sort: 'views',
    order: 'asc',
    empty: 'No hay noticias publicadas.',
  },
];

export const PAGE = 10;

/** Al pulsar la columna ya ordenada de mayor a menor se invierte; cualquier otra empieza de mayor a menor. */
export const nextOrder = (current: { sort: RankingSort; order: 'asc' | 'desc' }, clicked: RankingSort) =>
  clicked === current.sort && current.order === 'desc' ? 'asc' : 'desc';

/** Mensaje de la vista vacía; las que exigen una base mínima la mencionan. */
export const emptyMessage = (view: View) =>
  `${view.empty}${view.minViews ? ` (mínimo ${view.minViews} visualizaciones).` : ''}`;

/** Clases de la insignia de variación: positiva, negativa o neutra. */
export const growthTone = (growth: number) =>
  growth > 0
    ? 'bg-secondary/10 text-secondary'
    : growth < 0
      ? 'bg-error/10 text-error'
      : 'text-neutral-muted';

/** Peso de una noticia sobre el total de visualizaciones (0–100); 0 si no hay base. */
export const viewsShare = (views: number, total: number) => (total ? (views / total) * 100 : 0);
