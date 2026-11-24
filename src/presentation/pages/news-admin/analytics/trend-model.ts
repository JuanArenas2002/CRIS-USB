// Geometría y totales de la gráfica de evolución (funciones puras, sin React).
import type { Point } from '@/infrastructure/news/analytics-api';

export const CHART_HEIGHT = 280;
/** Márgenes del área de trazado. */
export const MARGIN = { l: 52, r: 12, t: 16, b: 30 };

/** Máximo «redondo» del eje vertical (1, 2, 2,5, 5 o 10 × potencia de diez); mínimo 4. */
export function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

const UNITS: Record<string, string> = { day: 'día', week: 'semana', month: 'mes' };
/** Unidad de agrupación en singular: «día», «semana», «mes» o «año». */
export const granularityUnit = (granularity: string) => UNITS[granularity] ?? 'año';

const sumViews = (series: Point[]) => series.reduce((a, p) => a + p.page_views, 0);

/** Escalas, trazados y totales de la gráfica para un ancho dado. */
export function trendGeometry(points: Point[], prev: Point[], width: number) {
  const M = MARGIN;
  const iw = width - M.l - M.r;
  const ih = CHART_HEIGHT - M.t - M.b;
  const max = niceMax(Math.max(0, ...points.map((p) => p.page_views), ...prev.map((p) => p.page_views)));
  const x = (i: number) => M.l + (points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => M.t + ih - (v / max) * ih;
  const line = (series: Point[]) =>
    series
      .slice(0, points.length)
      .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.page_views).toFixed(1)}`)
      .join('');
  const area = `${line(points)}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  // Una etiqueta del eje horizontal cada `every` puntos, para que no se encimen.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 90))));
  return { iw, ih, max, x, y, line, area, every, total: sumViews(points), totalPrev: sumViews(prev) };
}

/** Índice del punto más cercano a la posición horizontal del puntero (acotado al rango de la serie). */
export function hoverIndex(clientX: number, left: number, iw: number, count: number): number {
  const i = Math.round(((clientX - left - MARGIN.l) / iw) * (count - 1));
  return Math.min(count - 1, Math.max(0, i));
}
