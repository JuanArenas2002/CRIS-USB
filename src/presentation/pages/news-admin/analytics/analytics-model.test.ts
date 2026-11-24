import type { Point, RankingRow } from '@/infrastructure/news/analytics-api';
import { change, fmtDay, fmtDuration, fmtPct } from './format';
import { kpiDelta, kpiValue } from './kpis';
import { VIEWS, emptyMessage, growthTone, nextOrder, viewsShare } from './performance-model';
import { rankingCsv } from './report-csv';
import { MARGIN, granularityUnit, hoverIndex, niceMax, trendGeometry } from './trend-model';
import { statsFilterFromParams } from './use-stats-filter';

const point = (period: string, page_views: number): Point => ({
  period,
  page_views,
  unique_visitors: 0,
  sessions: 0,
  active_seconds: 0,
  shares: 0,
});

test('formato: duraciones, porcentajes y fechas; sin base no se inventa un cero', () => {
  expect(fmtDuration(null)).toBe('—');
  expect(fmtDuration(45)).toBe('45 s');
  expect(fmtDuration(125)).toBe('2 min 05 s');
  expect(fmtDuration(3725)).toBe('1 h 2 min');
  expect(fmtPct(null)).toBe('—');
  expect(fmtPct(0.3333)).toBe('33,3 %');
  expect(fmtPct(0.5, 0)).toBe('50 %');
  expect(fmtDay('2026-11-07')).toBe('7 nov');
  expect(fmtDay('2026-11-07', 'week')).toBe('Sem. 7 nov');
  expect(fmtDay('2026-11-07', 'month')).toBe('nov 2026');
  expect(fmtDay('2026-11-07', 'year')).toBe('2026');
  expect(change(150, 100)).toBe(0.5);
  expect(change(5, 0)).toBeNull();
});

test('filtros: el periodo y las dependencias salen de la URL; «personalizado» usa desde/hasta', () => {
  const a = statsFilterFromParams(new URLSearchParams(''), '2026-11-20');
  expect(a).toMatchObject({ preset: '30', start: '2026-10-22', end: '2026-11-20', active: 0 });
  expect(a.filter).toMatchObject({ start_date: '2026-10-22', end_date: '2026-11-20' });

  const b = statsFilterFromParams(
    new URLSearchParams(
      'periodo=7&categoria=2&dependencia=faculty:9&dispositivo=mobile&canal=x&agrupar=week',
    ),
    '2026-11-20',
  );
  expect(b.filter).toEqual({
    start_date: '2026-11-14',
    end_date: '2026-11-20',
    granularity: 'week',
    category_id: 2,
    scope_type: 'faculty',
    scope_id: 9,
    device: 'mobile',
    channel: 'x',
  });
  expect(b.active).toBe(5);

  const c = statsFilterFromParams(
    new URLSearchParams('periodo=custom&desde=2026-01-01&hasta=2026-01-31'),
    'x',
  );
  expect(c).toMatchObject({ start: '2026-01-01', end: '2026-01-31' });
  // Personalizado sin fechas: hasta hoy y 30 días hacia atrás.
  expect(statsFilterFromParams(new URLSearchParams('periodo=custom'), '2026-11-20')).toMatchObject({
    start: '2026-10-22',
    end: '2026-11-20',
  });
});

test('gráfica: eje «redondo», unidad por granularidad, escalas y totales', () => {
  expect(niceMax(0)).toBe(4);
  expect(niceMax(4)).toBe(4);
  expect(niceMax(7)).toBe(10);
  expect(niceMax(23)).toBe(25);
  expect(niceMax(180)).toBe(200);
  expect(granularityUnit('day')).toBe('día');
  expect(granularityUnit('week')).toBe('semana');
  expect(granularityUnit('month')).toBe('mes');
  expect(granularityUnit('year')).toBe('año');

  const cur = [point('2026-01-01', 10), point('2026-01-02', 30), point('2026-01-03', 20)];
  const prev = [point('2025-12-30', 5), point('2025-12-31', 8)];
  const geo = trendGeometry(cur, prev, 720);
  expect(geo.total).toBe(60);
  expect(geo.totalPrev).toBe(13);
  expect(geo.max).toBe(50); // el mayor valor es 30: el siguiente tope «redondo» es 50
  expect(geo.x(0)).toBe(MARGIN.l);
  expect(geo.x(2)).toBe(720 - MARGIN.r);
  expect(geo.y(0)).toBeGreaterThan(geo.y(50)); // el 0 está abajo
  // La serie anterior se recorta a la longitud de la actual.
  expect(geo.line(prev).split('L')).toHaveLength(2);
  expect(geo.area.endsWith('Z')).toBe(true);
  // Un solo punto se centra; sin puntos no hay división por cero.
  expect(trendGeometry([point('2026-01-01', 1)], [], 720).x(0)).toBeCloseTo(
    MARGIN.l + (720 - MARGIN.l - MARGIN.r) / 2,
  );
});

test('gráfica: el puntero se acota al primer y último punto', () => {
  const iw = 600;
  expect(hoverIndex(MARGIN.l, 0, iw, 11)).toBe(0);
  expect(hoverIndex(MARGIN.l + iw / 2, 0, iw, 11)).toBe(5);
  expect(hoverIndex(-500, 0, iw, 11)).toBe(0);
  expect(hoverIndex(9999, 0, iw, 11)).toBe(10);
});

test('indicadores: valor por tipo y variación (pp para tasas, % para el resto; sin base → null)', () => {
  expect(kpiValue('count', null)).toBe('—');
  expect(kpiValue('count', 1234)).toBe('1.234');
  expect(kpiValue('duration', 90)).toBe('1 min 30 s');
  expect(kpiValue('ratio', 0.25)).toBe('25,0 %');

  expect(kpiDelta(null, 5, 'count')).toBeNull();
  expect(kpiDelta(5, 0, 'count')).toBeNull(); // nunca un porcentaje sobre cero
  expect(kpiDelta(150, 100, 'count')).toEqual({ text: '+50,0 %', tone: 'up' });
  expect(kpiDelta(50, 100, 'count')).toEqual({ text: '-50,0 %', tone: 'down' });
  expect(kpiDelta(100, 100, 'count')).toEqual({ text: '0,0 %', tone: 'flat' });
  expect(kpiDelta(0.5, 0, 'ratio')).toEqual({ text: '+50,0 pp', tone: 'up' }); // las tasas sí comparan con cero
  expect(kpiDelta(0.3, 0.4, 'ratio')).toEqual({ text: '-10,0 pp', tone: 'down' });
});

test('ranking: orden alterno al repetir la columna, mensajes de vacío y peso de cada noticia', () => {
  expect(nextOrder({ sort: 'views', order: 'desc' }, 'views')).toBe('asc');
  expect(nextOrder({ sort: 'views', order: 'asc' }, 'views')).toBe('desc');
  expect(nextOrder({ sort: 'views', order: 'desc' }, 'shares')).toBe('desc');
  expect(emptyMessage(VIEWS[0]!)).toBe('Sin visualizaciones en el periodo.');
  expect(emptyMessage(VIEWS.find((v) => v.key === 'avg_active')!)).toBe(
    'Ninguna noticia alcanza la base mínima. (mínimo 5 visualizaciones).',
  );
  expect(growthTone(3)).toContain('text-secondary');
  expect(growthTone(-3)).toContain('text-error');
  expect(growthTone(0)).toBe('text-neutral-muted');
  expect(viewsShare(25, 100)).toBe(25);
  expect(viewsShare(25, 0)).toBe(0);
});

test('CSV: «;», BOM, comillas escapadas y campos vacíos sin base', () => {
  const row = (over: Partial<RankingRow>): RankingRow => ({
    id: 1,
    slug: 's',
    title: 'Con "comillas"; y punto y coma',
    category_id: 1,
    published_at: '2026-11-03T10:00:00Z',
    views: 10,
    prev_views: 4,
    visitors: 7,
    shares: 2,
    active_seconds: 100,
    avg_active: 61.6,
    engaged_rate: 0.4123,
    growth: 6,
    ...over,
  });
  const csv = rankingCsv([
    row({}),
    row({ title: 'Sin base', avg_active: null, engaged_rate: null, published_at: null }),
  ]);
  const [head, a, b] = csv.split('\r\n');
  expect(csv.startsWith('﻿"Noticia";"Publicada"')).toBe(true);
  expect(head).toContain('"Lectura comprometida (%)"');
  expect(a).toBe('"Con ""comillas""; y punto y coma";"2026-11-03";"10";"4";"6";"7";"62";"41,2";"2"');
  expect(b).toBe('"Sin base";"";"10";"4";"6";"7";"";"";"2"');
});
