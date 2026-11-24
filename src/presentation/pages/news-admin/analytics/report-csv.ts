// Exportación del ranking de noticias a CSV: el armado del texto es puro; la descarga, un efecto aparte.
import { analyticsApi, type RankingRow, type StatsFilter } from '@/infrastructure/news/analytics-api';

const HEAD = [
  'Noticia',
  'Publicada',
  'Visualizaciones',
  'Periodo anterior',
  'Variación',
  'Visitantes (estimado)',
  'Lectura promedio (s)',
  'Lectura comprometida (%)',
  'Compartidos',
];

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** CSV con «;» y BOM: Excel en español lo abre con tildes y columnas correctas. */
export function rankingCsv(rows: RankingRow[]): string {
  const lines = rows.map((r) =>
    [
      r.title,
      r.published_at?.slice(0, 10),
      r.views,
      r.prev_views,
      r.growth,
      r.visitors,
      r.avg_active === null ? '' : Math.round(r.avg_active),
      r.engaged_rate === null ? '' : (r.engaged_rate * 100).toFixed(1).replace('.', ','),
      r.shares,
    ]
      .map(cell)
      .join(';'),
  );
  return '﻿' + [HEAD.map(cell).join(';'), ...lines].join('\r\n');
}

async function allRanking(filter: StatsFilter) {
  const rows: RankingRow[] = [];
  for (let page = 1; ; page++) {
    const r = await analyticsApi.ranking({ ...filter, sort: 'views', order: 'desc', page, page_size: 100 });
    rows.push(...r.items);
    if (rows.length >= r.total || !r.items.length) break;
  }
  return rows;
}

export async function exportCsv(filter: StatsFilter) {
  const blob = new Blob([rankingCsv(await allRanking(filter))], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `estadisticas-noticias_${filter.start_date}_${filter.end_date}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
