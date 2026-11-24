// Conclusiones en lenguaje natural del resumen ejecutivo. Cada una solo aparece con base suficiente
// (nunca un porcentaje sobre cero).
import type { ReactNode } from 'react';
import type { NewsStats, Overview, RankingRow } from '@/infrastructure/news/analytics-api';
import { DEVICE, SOURCE, change, fmtDuration, fmtInt, fmtPct } from './format';

export type Insight = { icon: string; text: ReactNode };

/** La categoría con más visualizaciones y su peso sobre el total; null si no hay datos. */
export function leader(rows: { key: string; page_views: number }[]) {
  const total = rows.reduce((a, r) => a + r.page_views, 0);
  const top = [...rows].sort((a, b) => b.page_views - a.page_views)[0];
  return top && total ? { key: top.key, ratio: top.page_views / total } : null;
}

function growthInsight(d: Overview): Insight {
  const delta = change(d.totals.page_views, d.previous.page_views);
  if (delta === null)
    return {
      icon: 'trending_up',
      text: (
        <>
          Se registraron <b>{fmtInt(d.totals.page_views)}</b> visualizaciones; el periodo anterior no tiene
          datos para comparar.
        </>
      ),
    };
  return {
    icon: delta >= 0 ? 'trending_up' : 'trending_down',
    text: (
      <>
        Las visualizaciones {delta >= 0 ? 'crecieron' : 'cayeron'} <b>{fmtPct(Math.abs(delta))}</b> frente al
        periodo anterior ({fmtInt(d.previous.page_views)} → {fmtInt(d.totals.page_views)}).
      </>
    ),
  };
}

function topNewsInsight(top: RankingRow | undefined, totalViews: number): Insight | null {
  if (!top || !top.views) return null;
  return {
    icon: 'star',
    text: (
      <>
        «{top.title}» es la más leída: <b>{fmtPct(top.views / totalViews)}</b> de las visualizaciones.
      </>
    ),
  };
}

function sourceInsight(d: Overview): Insight | null {
  const src = leader(d.sources);
  if (!src) return null;
  return {
    icon: 'public',
    text: (
      <>
        <b>{fmtPct(src.ratio, 0)}</b> del tráfico llega por {SOURCE[src.key]?.toLowerCase() ?? src.key}.
      </>
    ),
  };
}

function deviceInsight(d: Overview): Insight | null {
  const dev = leader(d.devices);
  if (!dev) return null;
  return {
    icon: 'fit_screen',
    text: (
      <>
        <b>{fmtPct(dev.ratio, 0)}</b> de las lecturas se hace desde{' '}
        {DEVICE[dev.key]?.toLowerCase() ?? dev.key}.
      </>
    ),
  };
}

function engagementInsight(d: Overview): Insight | null {
  if (d.totals.engaged_rate === null) return null;
  return {
    icon: 'schedule',
    text: (
      <>
        <b>{fmtPct(d.totals.engaged_rate, 0)}</b> de las lecturas supera 30 s de atención activa; el promedio
        es <b>{fmtDuration(d.totals.avg_active_per_view)}</b>.
      </>
    ),
  };
}

/** Hasta 5 conclusiones: crecimiento, noticia líder, procedencia, dispositivo y lectura comprometida. */
export function insightsFor(d: Overview, top?: RankingRow): Insight[] {
  if (!d.totals.page_views)
    return [{ icon: 'insights', text: 'Aún no hay lecturas registradas en este periodo.' }];
  const all = [
    growthInsight(d),
    topNewsInsight(top, d.totals.page_views),
    sourceInsight(d),
    deviceInsight(d),
    engagementInsight(d),
  ];
  return all.filter((i): i is Insight => i !== null).slice(0, 5);
}

/** Las de una noticia: las generales más su posición frente a las demás del periodo. */
export function newsInsights(d: NewsStats): Insight[] {
  const out = insightsFor(d);
  const c = d.comparison;
  if (c && d.totals.page_views)
    out.splice(1, 0, {
      icon: 'military_tech',
      text: (
        <>
          Supera en visualizaciones al <b>{c.percentile} %</b> de las {fmtInt(c.peers)} noticias leídas en el
          mismo periodo.
        </>
      ),
    });
  return out.slice(0, 5);
}
