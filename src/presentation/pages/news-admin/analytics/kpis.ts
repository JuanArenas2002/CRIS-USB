// Indicadores de la franja superior: definiciones y cálculo de valor y variación (funciones puras).
import type { Point, Totals } from '@/infrastructure/news/analytics-api';
import { fmtDuration, fmtInt, fmtPct } from './format';

export type Kind = 'count' | 'duration' | 'ratio';
export type KpiSpec = {
  label: string;
  key: keyof Totals;
  kind: Kind;
  tag?: 'Estimado' | 'Calculado';
  hint: string;
  spark?: (p: Point) => number | null;
};

const avgPerView = (p: Point) => (p.page_views ? p.active_seconds / p.page_views : null);

export const GENERAL_KPIS: KpiSpec[] = [
  {
    label: 'Visualizaciones',
    key: 'page_views',
    kind: 'count',
    hint: 'Lecturas registradas: una por noticia y sesión (recargar no suma).',
    spark: (p) => p.page_views,
  },
  {
    label: 'Visitantes únicos',
    key: 'unique_visitors',
    kind: 'count',
    tag: 'Estimado',
    hint: 'Suma de visitantes únicos de cada día, sin cookies ni datos personales.',
    spark: (p) => p.unique_visitors,
  },
  {
    label: 'Lectura promedio',
    key: 'avg_active_per_view',
    kind: 'duration',
    tag: 'Calculado',
    hint: 'Tiempo con actividad real por visualización; no cuenta pestañas en segundo plano ni inactividad.',
    spark: avgPerView,
  },
  {
    label: 'Lectura comprometida',
    key: 'engaged_rate',
    kind: 'ratio',
    tag: 'Calculado',
    hint: 'Visualizaciones con al menos 30 s de actividad.',
  },
  {
    label: 'Compartidos',
    key: 'shares',
    kind: 'count',
    hint: 'Clics en las opciones de compartir del portal (no envíos confirmados).',
    spark: (p) => p.shares,
  },
  {
    label: 'Noticias publicadas',
    key: 'news_published',
    kind: 'count',
    hint: 'Publicadas dentro del periodo.',
  },
];

export const NEWS_KPIS: KpiSpec[] = [
  GENERAL_KPIS[0]!,
  GENERAL_KPIS[1]!,
  GENERAL_KPIS[2]!,
  {
    label: 'Lectura acumulada',
    key: 'active_seconds',
    kind: 'duration',
    tag: 'Calculado',
    hint: 'Suma del tiempo con actividad real.',
    spark: (p) => p.active_seconds,
  },
  GENERAL_KPIS[3]!,
  GENERAL_KPIS[4]!,
];

/** El valor del indicador en su formato; «—» si no hay base. */
export function kpiValue(kind: Kind, value: number | null): string {
  if (value === null) return '—';
  if (kind === 'duration') return fmtDuration(value);
  if (kind === 'ratio') return fmtPct(value);
  return fmtInt(value);
}

export type KpiDelta = { text: string; tone: 'up' | 'down' | 'flat' };

/**
 * Variación frente al periodo anterior: en puntos porcentuales para las tasas y en % para el resto.
 * null si no hay base de comparación (nunca un porcentaje sobre cero).
 */
export function kpiDelta(cur: number | null, prev: number | null, kind: Kind): KpiDelta | null {
  if (cur === null || prev === null || (kind !== 'ratio' && prev === 0)) return null;
  const diff = kind === 'ratio' ? (cur - prev) * 100 : ((cur - prev) / prev) * 100;
  const tone = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat';
  const text = `${diff > 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')} ${kind === 'ratio' ? 'pp' : '%'}`;
  return { text, tone };
}
