import { useEffect, useRef, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  analyticsApi,
  type GeneralStats,
  type NewsStats,
  type Overview,
  type Point,
  type RankingRow,
  type RankingSort,
  type StatsFilter,
  type Totals,
} from '@/infrastructure/news/analytics-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCatalogs, useOrg } from './queries';
import { ErrorLine, Field, Input, Loading, Pager, ROOT, Select, fmtDate } from './ui';

/**
 * Estadísticas de noticias, en formato de informe ejecutivo:
 *   1. resumen en lenguaje natural + lo que pasa en vivo;
 *   2. franja de indicadores con variación y tendencia;
 *   3. evolución frente al periodo anterior;
 *   4. rendimiento por noticia (una tabla, varias lecturas);
 *   5. procedencia, dispositivos, canales y lectura.
 * Todo sale del backend (agregado en PostgreSQL). Conteos registrados sin marca; «Estimado» y «Calculado»
 * marcados. Los filtros viven en la URL. «Imprimir informe» produce un PDF limpio (sin navegación).
 */

// ---------- formato ----------
const nf = new Intl.NumberFormat('es-CO');
const fmtInt = (v: number) => nf.format(Math.round(v));
const fmtPct = (v: number | null, digits = 1) =>
  v === null ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')} %`;
function fmtDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`;
}
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDay(iso: string, granularity = 'day'): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  if (granularity === 'year') return String(y);
  if (granularity === 'month') return `${MONTHS[m - 1]} ${y}`;
  return `${granularity === 'week' ? 'Sem. ' : ''}${d} ${MONTHS[m - 1]}`;
}
const fmtRange = (a: string, b: string) => `${fmtDay(a)} ${a.slice(0, 4)} – ${fmtDay(b)} ${b.slice(0, 4)}`;
const change = (cur: number, prev: number) => (prev ? (cur - prev) / prev : null);

const SOURCE: Record<string, string> = {
  direct: 'Directo (sin referencia)',
  internal: 'Desde el portal',
  search: 'Buscadores',
  social: 'Redes sociales',
  external: 'Otros sitios',
};
const DEVICE: Record<string, string> = { desktop: 'Computador', mobile: 'Celular', tablet: 'Tableta' };
const CHANNEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  email: 'Correo',
  copy_link: 'Copiar enlace',
  native: 'Menú del dispositivo',
  other: 'Otro',
};
// Serie principal = token secondary (contraste ≥ 3:1 sobre blanco). Periodo anterior = gris neutro: es una
// referencia, no una segunda categoría.
const C = { main: '#527616', previous: '#9ca3af' };

// ---------- filtros (en la URL) ----------
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const minusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};
const PRESETS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
  { value: '365', label: '12 meses' },
  { value: 'custom', label: 'Personalizado' },
];
const FILTER_KEYS = ['categoria', 'dependencia', 'dispositivo', 'canal', 'agrupar'];

function useStatsFilter() {
  const [params, setParams] = useSearchParams();
  const preset = params.get('periodo') ?? '30';
  const end = preset === 'custom' ? (params.get('hasta') ?? today()) : today();
  const start =
    preset === 'custom' ? (params.get('desde') ?? minusDays(end, 29)) : minusDays(end, Number(preset) - 1);
  const [scopeType, scopeId] = (params.get('dependencia') ?? '').split(':');
  const filter: StatsFilter = {
    start_date: start,
    end_date: end,
    granularity: params.get('agrupar') ?? undefined,
    category_id: Number(params.get('categoria')) || undefined,
    scope_type: scopeType || undefined,
    scope_id: Number(scopeId) || undefined,
    device: params.get('dispositivo') ?? undefined,
    channel: params.get('canal') ?? undefined,
  };
  const set = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        if (key === 'periodo' && value === 'custom') {
          p.set('desde', start);
          p.set('hasta', end);
        }
        return p;
      },
      { replace: true },
    );
  const active = FILTER_KEYS.filter((k) => params.get(k)).length;
  const clear = () =>
    setParams(
      (p) => {
        FILTER_KEYS.forEach((k) => p.delete(k));
        return p;
      },
      { replace: true },
    );
  return { filter, preset, params, set, active, clear };
}

const TOOL_BUTTON =
  'inline-flex h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-lowest px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt';

/** Control segmentado del periodo + filtros secundarios plegados + exportación. */
function Toolbar({ withNewsFilters = true, onExport }: { withNewsFilters?: boolean; onExport?: () => void }) {
  const { filter, preset, params, set, active, clear } = useStatsFilter();
  const [open, setOpen] = useState(active > 0);
  const catalogs = useCatalogs();
  const { units } = useOrg();
  const unitLabel: Record<string, string> = {
    faculty: 'Facultad',
    research_center: 'Centro',
    academic_program: 'Programa',
  };
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Periodo"
          className="inline-flex flex-wrap rounded-xl border border-border-subtle bg-surface-container-lowest p-1"
        >
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={preset === p.value}
              onClick={() => set('periodo', p.value)}
              className={`h-9 rounded-lg px-3.5 text-label-md font-semibold transition-colors ${
                preset === p.value
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-cream-alt hover:text-on-surface'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="stats-filters"
          onClick={() => setOpen((v) => !v)}
          className={TOOL_BUTTON}
        >
          <Icon name="filter_alt_off" className="text-[18px]" />
          Filtros
          {active > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-label-sm text-on-primary">
              {active}
            </span>
          )}
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {onExport && (
            <button type="button" onClick={onExport} className={TOOL_BUTTON}>
              <Icon name="download" className="text-[18px]" /> Exportar CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-label-md font-semibold text-on-primary hover:bg-secondary"
          >
            <Icon name="picture_as_pdf" className="text-[18px]" /> Imprimir informe
          </button>
        </div>
      </div>
      {open && (
        <div
          id="stats-filters"
          role="group"
          aria-label="Filtros de las estadísticas"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border-subtle bg-surface-container-lowest p-4"
        >
          {preset === 'custom' && (
            <>
              <Field label="Desde">
                <Input
                  type="date"
                  value={filter.start_date}
                  max={filter.end_date}
                  onChange={(e) => set('desde', e.target.value)}
                />
              </Field>
              <Field label="Hasta">
                <Input
                  type="date"
                  value={filter.end_date}
                  min={filter.start_date}
                  max={today()}
                  onChange={(e) => set('hasta', e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="Agrupar por">
            <Select
              value={params.get('agrupar') ?? ''}
              onChange={(e) => set('agrupar', e.target.value)}
              empty="Automático"
              options={[
                { value: 'day', label: 'Día' },
                { value: 'week', label: 'Semana' },
                { value: 'month', label: 'Mes' },
                { value: 'year', label: 'Año' },
              ]}
            />
          </Field>
          {withNewsFilters && (
            <>
              <Field label="Categoría">
                <Select
                  value={params.get('categoria') ?? ''}
                  onChange={(e) => set('categoria', e.target.value)}
                  empty="Todas"
                  options={(catalogs.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Dependencia">
                <Select
                  value={params.get('dependencia') ?? ''}
                  onChange={(e) => set('dependencia', e.target.value)}
                  empty="Todas"
                  className="max-w-64"
                  options={Object.entries(units).flatMap(([type, list]) =>
                    list.map((u) => ({ value: `${type}:${u.id}`, label: `${unitLabel[type]}: ${u.name}` })),
                  )}
                />
              </Field>
            </>
          )}
          <Field label="Dispositivo">
            <Select
              value={params.get('dispositivo') ?? ''}
              onChange={(e) => set('dispositivo', e.target.value)}
              empty="Todos"
              options={Object.entries(DEVICE).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Canal (solo compartidos)">
            <Select
              value={params.get('canal') ?? ''}
              onChange={(e) => set('canal', e.target.value)}
              empty="Todos"
              options={Object.entries(CHANNEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          {active > 0 && (
            <button
              type="button"
              onClick={clear}
              className="h-10 rounded-lg px-3 text-label-md font-semibold text-secondary hover:bg-cta-sage"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- en vivo ----------
const liveRefresh = (f: StatsFilter, ms: number) =>
  f.end_date === today() ? { staleTime: 0, refetchInterval: ms } : { staleTime: Infinity };

function Live({ filter, newsId }: { filter: StatsFilter; newsId?: number }) {
  const [params] = useSearchParams();
  const live = filter.end_date === today();
  const q = useQuery({
    queryKey: ['news-admin', 'analytics', 'live', filter, newsId],
    queryFn: () => analyticsApi.live(filter, newsId),
    enabled: live,
    ...liveRefresh(filter, 10_000),
  });
  const d = q.data;
  return (
    <section
      aria-label="En vivo"
      className="flex h-full min-w-0 flex-col gap-3 rounded-xl bg-white/[0.07] p-5 ring-1 ring-white/10 lg:w-80"
    >
      <span className="inline-flex items-center gap-2 text-label-md font-bold tracking-wide text-tertiary-fixed uppercase">
        <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
          {live && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tertiary-fixed opacity-70 motion-reduce:animate-none" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live ? 'bg-tertiary-fixed' : 'bg-white/40'}`}
          />
        </span>
        {live ? 'En vivo' : 'Periodo cerrado'}
      </span>
      {!live ? (
        <p className="text-body-sm text-primary-fixed-dim">
          Los datos de un periodo pasado no cambian. Elige un periodo que incluya hoy para verlos en vivo.
        </p>
      ) : q.isError ? (
        <p className="text-body-sm text-error-container">No se pudo actualizar.</p>
      ) : d ? (
        <>
          <p className="text-body-sm text-primary-fixed-dim" aria-live="polite">
            <span className="block text-[2.5rem] leading-none font-bold text-on-primary tabular-nums">
              {fmtInt(d.active_readers)}
            </span>{' '}
            {d.active_readers === 1 ? 'persona leyendo' : 'personas leyendo'} ahora
          </p>
          <p className="text-body-sm text-primary-fixed-dim">
            <b className="text-on-primary tabular-nums">{fmtInt(d.views_last_30_min)}</b> visualizaciones en
            los últimos 30 min
          </p>
          {!newsId && d.reading_now.length > 0 && (
            <p className="min-w-0 text-body-sm text-primary-fixed-dim">
              Más leída ahora:{' '}
              <Link
                to={`${ROOT}/${d.reading_now[0]!.id}/estadisticas?${params}`}
                className="font-semibold text-on-primary underline underline-offset-2"
              >
                {d.reading_now[0]!.title}
              </Link>
            </p>
          )}
          <p
            className="mt-auto text-label-sm text-primary-fixed-dim"
            title="Se actualiza cada 10 s; el resto del informe, cada minuto"
          >
            Actualizado {new Date(q.dataUpdatedAt).toLocaleTimeString('es-CO')}
          </p>
        </>
      ) : (
        <p className="text-body-sm text-primary-fixed-dim">Cargando…</p>
      )}
    </section>
  );
}

// ---------- resumen ejecutivo ----------
type Insight = { icon: string; text: ReactNode };

function leader(rows: { key: string; page_views: number }[]) {
  const total = rows.reduce((a, r) => a + r.page_views, 0);
  const top = [...rows].sort((a, b) => b.page_views - a.page_views)[0];
  return top && total ? { key: top.key, ratio: top.page_views / total } : null;
}

/** Conclusiones en lenguaje natural, solo con base suficiente (nunca un porcentaje sobre cero). */
function insightsFor(d: Overview, top?: RankingRow): Insight[] {
  const t = d.totals;
  if (!t.page_views) return [{ icon: 'insights', text: 'Aún no hay lecturas registradas en este periodo.' }];
  const out: Insight[] = [];
  const delta = change(t.page_views, d.previous.page_views);
  out.push(
    delta === null
      ? {
          icon: 'trending_up',
          text: (
            <>
              Se registraron <b>{fmtInt(t.page_views)}</b> visualizaciones; el periodo anterior no tiene datos
              para comparar.
            </>
          ),
        }
      : {
          icon: delta >= 0 ? 'trending_up' : 'trending_down',
          text: (
            <>
              Las visualizaciones {delta >= 0 ? 'crecieron' : 'cayeron'} <b>{fmtPct(Math.abs(delta))}</b>{' '}
              frente al periodo anterior ({fmtInt(d.previous.page_views)} → {fmtInt(t.page_views)}).
            </>
          ),
        },
  );
  if (top && top.views)
    out.push({
      icon: 'star',
      text: (
        <>
          «{top.title}» es la más leída: <b>{fmtPct(top.views / t.page_views)}</b> de las visualizaciones.
        </>
      ),
    });
  const src = leader(d.sources);
  if (src)
    out.push({
      icon: 'public',
      text: (
        <>
          <b>{fmtPct(src.ratio, 0)}</b> del tráfico llega por {SOURCE[src.key]?.toLowerCase() ?? src.key}.
        </>
      ),
    });
  const dev = leader(d.devices);
  if (dev)
    out.push({
      icon: 'fit_screen',
      text: (
        <>
          <b>{fmtPct(dev.ratio, 0)}</b> de las lecturas se hace desde{' '}
          {DEVICE[dev.key]?.toLowerCase() ?? dev.key}.
        </>
      ),
    });
  if (t.engaged_rate !== null)
    out.push({
      icon: 'schedule',
      text: (
        <>
          <b>{fmtPct(t.engaged_rate, 0)}</b> de las lecturas supera 30 s de atención activa; el promedio es{' '}
          <b>{fmtDuration(t.avg_active_per_view)}</b>.
        </>
      ),
    });
  return out.slice(0, 5);
}

function Summary({
  title,
  data,
  insights,
  filter,
  newsId,
}: {
  title: string;
  data: Overview;
  insights: Insight[];
  filter: StatsFilter;
  newsId?: number;
}) {
  return (
    <section
      aria-label="Resumen ejecutivo"
      className="relative overflow-hidden rounded-2xl bg-surface-dark-forest p-6 text-on-primary sm:p-8 print:bg-transparent print:p-0 print:text-on-surface"
    >
      {/* Trama sutil: profundidad sin distraer (no se imprime). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] print:hidden"
        style={{
          backgroundImage:
            'radial-gradient(circle at 88% 10%, #2DDE6A 0, transparent 40%), repeating-linear-gradient(135deg, #ffffff 0 1px, transparent 1px 16px)',
        }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">
          <p className="text-label-md font-bold tracking-wider text-tertiary-fixed uppercase print:text-secondary">
            Resumen ejecutivo
          </p>
          <h2 className="mt-1 text-title-lg font-bold">{title}</h2>
          <p className="text-body-sm text-primary-fixed-dim print:text-neutral-muted">
            {fmtRange(data.period.start, data.period.end)} · comparado con{' '}
            {fmtRange(data.period.previous_start, data.period.previous_end)}
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            {insights.map((i, n) => (
              <li key={n} className="flex items-start gap-3 text-body-md leading-snug">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 print:bg-cta-sage">
                  <Icon name={i.icon} className="text-[16px] text-tertiary-fixed print:text-secondary" />
                </span>
                <span className="text-primary-fixed [&_b]:font-bold [&_b]:text-on-primary print:text-on-surface print:[&_b]:text-on-surface">
                  {i.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="print:hidden">
          <Live filter={filter} newsId={newsId} />
        </div>
      </div>
    </section>
  );
}

// ---------- indicadores ----------
type Kind = 'count' | 'duration' | 'ratio';
type KpiSpec = {
  label: string;
  key: keyof Totals;
  kind: Kind;
  tag?: 'Estimado' | 'Calculado';
  hint: string;
  spark?: (p: Point) => number | null;
};

function Sparkline({ values }: { values: (number | null)[] }) {
  const v = values.map((x) => x ?? 0);
  if (v.length < 2 || !v.some(Boolean)) return <div className="h-8" />;
  const max = Math.max(...v);
  const pts = v.map(
    (x, i) => `${((i / (v.length - 1)) * 100).toFixed(2)},${(30 - (x / max) * 26).toFixed(2)}`,
  );
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <polygon points={`0,32 ${pts.join(' ')} 100,32`} fill={C.main} fillOpacity={0.08} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={C.main}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Delta({ cur, prev, kind }: { cur: number | null; prev: number | null; kind: Kind }) {
  if (cur === null || prev === null || (kind !== 'ratio' && prev === 0))
    return <span className="text-label-sm text-neutral-muted">Sin base de comparación</span>;
  const diff = kind === 'ratio' ? (cur - prev) * 100 : ((cur - prev) / prev) * 100;
  const up = diff > 0.05;
  const down = diff < -0.05;
  const text = `${diff > 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')} ${kind === 'ratio' ? 'pp' : '%'}`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 self-start rounded-full px-2 py-0.5 text-label-sm font-bold tabular-nums ${
        up
          ? 'bg-secondary/10 text-secondary'
          : down
            ? 'bg-error/10 text-error'
            : 'bg-canvas-cream text-neutral-muted'
      }`}
    >
      <Icon name={up ? 'trending_up' : down ? 'trending_down' : 'remove'} className="text-[14px]" />
      {text}
    </span>
  );
}

function KpiStrip({ data, items }: { data: Overview; items: KpiSpec[] }) {
  return (
    <section aria-label="Indicadores principales">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-title-md font-bold text-on-surface">Indicadores</h2>
        <p className="text-label-sm text-neutral-muted">
          Variación vs. {fmtRange(data.period.previous_start, data.period.previous_end)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 print:grid-cols-3">
        {items.map((k) => {
          const cur = data.totals[k.key];
          const prev = data.previous[k.key];
          const value =
            cur === null
              ? '—'
              : k.kind === 'duration'
                ? fmtDuration(cur)
                : k.kind === 'ratio'
                  ? fmtPct(cur)
                  : fmtInt(cur);
          return (
            <div key={k.key} className="flex min-w-0 flex-col gap-2 bg-surface-container-lowest p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-label-md font-semibold text-on-surface-variant" title={k.hint}>
                  {k.label}
                </span>
                {k.tag && (
                  <span className="rounded-full bg-canvas-cream px-2 py-0.5 text-label-sm text-neutral-muted">
                    {k.tag}
                  </span>
                )}
              </div>
              <span className="text-[1.875rem] leading-tight font-bold tracking-tight text-on-surface tabular-nums">
                {value}
              </span>
              <Delta cur={cur} prev={prev} kind={k.kind} />
              {k.spark ? <Sparkline values={data.timeline.map(k.spark)} /> : <div className="h-8" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const avgPerView = (p: Point) => (p.page_views ? p.active_seconds / p.page_views : null);
const GENERAL_KPIS: KpiSpec[] = [
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
const NEWS_KPIS: KpiSpec[] = [
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

// ---------- evolución ----------
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Visualizaciones del periodo (área) frente a las del periodo anterior (línea gris), un solo eje. */
function Trend({ data }: { data: Overview }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const points = data.timeline;
  const prev = data.previous_timeline;
  const g = data.period.granularity;
  const H = 280;
  const M = { l: 52, r: 12, t: 16, b: 30 };
  const iw = width - M.l - M.r;
  const ih = H - M.t - M.b;
  const max = niceMax(Math.max(0, ...points.map((p) => p.page_views), ...prev.map((p) => p.page_views)));
  const x = (i: number) => M.l + (points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => M.t + ih - (v / max) * ih;
  const line = (series: Point[]) =>
    series
      .slice(0, points.length)
      .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.page_views).toFixed(1)}`)
      .join('');
  const area = `${line(points)}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 90))));
  const h = hover === null ? null : points[hover];
  const hp = hover === null ? undefined : prev[hover];
  const unit = g === 'day' ? 'día' : g === 'week' ? 'semana' : g === 'month' ? 'mes' : 'año';
  const total = points.reduce((a, p) => a + p.page_views, 0);
  const totalPrev = prev.reduce((a, p) => a + p.page_views, 0);

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 print:break-inside-avoid">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-title-md font-bold text-on-surface">Evolución de las visualizaciones</h2>
          <p className="text-body-sm text-neutral-muted">
            Por {unit}, frente al periodo anterior de igual duración.
          </p>
        </div>
        <ul className="flex flex-wrap gap-5 text-label-md text-on-surface-variant">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-5 rounded-sm" style={{ background: C.main }} />
            Este periodo · <b className="text-on-surface tabular-nums">{fmtInt(total)}</b>
          </li>
          <li className="flex items-center gap-2">
            <svg width="20" height="8" aria-hidden="true">
              <line x1="0" x2="20" y1="4" y2="4" stroke={C.previous} strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Periodo anterior · <b className="text-on-surface tabular-nums">{fmtInt(totalPrev)}</b>
          </li>
        </ul>
      </div>
      {!total && !totalPrev ? (
        <Empty>No hay visualizaciones en este periodo.</Empty>
      ) : (
        <div ref={ref} className="relative">
          <svg
            width={width}
            height={H}
            role="img"
            aria-label={`Visualizaciones por ${unit} frente al periodo anterior. El detalle está en la tabla.`}
            className="block max-w-full"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round(((e.clientX - r.left - M.l) / iw) * (points.length - 1));
              setHover(Math.min(points.length - 1, Math.max(0, i)));
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={C.main} stopOpacity={0.22} />
                <stop offset="100%" stopColor={C.main} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f}>
                <line
                  x1={M.l}
                  x2={width - M.r}
                  y1={y(max * f)}
                  y2={y(max * f)}
                  stroke="var(--color-border-subtle)"
                  strokeDasharray={f ? '2 4' : undefined}
                />
                <text
                  x={M.l - 10}
                  y={y(max * f) + 4}
                  textAnchor="end"
                  className="fill-neutral-muted text-[11px]"
                >
                  {fmtInt(max * f)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % every === 0 ? (
                <text
                  key={p.period}
                  x={x(i)}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-neutral-muted text-[11px]"
                >
                  {fmtDay(p.period, g)}
                </text>
              ) : null,
            )}
            <path d={area} fill="url(#trend-fill)" />
            <path d={line(prev)} fill="none" stroke={C.previous} strokeWidth={2} strokeDasharray="5 4" />
            <path d={line(points)} fill="none" stroke={C.main} strokeWidth={2.5} strokeLinejoin="round" />
            {h && hover !== null && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={M.t}
                  y2={M.t + ih}
                  stroke="var(--color-outline-variant)"
                />
                {hp && (
                  <circle
                    cx={x(hover)}
                    cy={y(hp.page_views)}
                    r={4}
                    fill={C.previous}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={x(hover)}
                  cy={y(h.page_views)}
                  r={5}
                  fill={C.main}
                  stroke="#fff"
                  strokeWidth={2}
                />
              </g>
            )}
          </svg>
          {h && hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 w-60 rounded-xl border border-border-subtle bg-surface-container-lowest p-3 text-label-sm shadow-xl"
              style={{ left: Math.min(Math.max(0, x(hover) + 14), width - 248) }}
            >
              <p className="mb-1.5 font-bold text-on-surface">{fmtDay(h.period, g)}</p>
              <TipRow color={C.main} label="Visualizaciones" value={fmtInt(h.page_views)} />
              {hp && (
                <TipRow
                  color={C.previous}
                  label={`Anterior (${fmtDay(hp.period, g)})`}
                  value={fmtInt(hp.page_views)}
                />
              )}
              <div className="my-1.5 border-t border-border-subtle" />
              <TipRow label="Visitantes únicos (est.)" value={fmtInt(h.unique_visitors)} />
              <TipRow label="Sesiones" value={fmtInt(h.sessions)} />
              <TipRow label="Compartidos" value={fmtInt(h.shares)} />
              <TipRow label="Lectura acumulada" value={fmtDuration(h.active_seconds)} />
            </div>
          )}
        </div>
      )}
      <details className="mt-3 print:hidden">
        <summary className="cursor-pointer text-label-md font-semibold text-secondary">
          Ver como tabla
        </summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="sticky top-0 bg-surface-container-lowest text-label-sm text-neutral-muted">
              <tr>
                {[
                  'Periodo',
                  'Visualizaciones',
                  'Periodo anterior',
                  'Visitantes únicos',
                  'Sesiones',
                  'Compartidos',
                  'Lectura acumulada',
                ].map((c) => (
                  <th key={c} className="py-1.5 pr-4 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((p, i) => (
                <tr key={p.period} className="border-t border-border-subtle">
                  <td className="py-1.5 pr-4">{fmtDay(p.period, g)}</td>
                  <td className="pr-4">{fmtInt(p.page_views)}</td>
                  <td className="pr-4">{prev[i] ? fmtInt(prev[i]!.page_views) : '—'}</td>
                  <td className="pr-4">{fmtInt(p.unique_visitors)}</td>
                  <td className="pr-4">{fmtInt(p.sessions)}</td>
                  <td className="pr-4">{fmtInt(p.shares)}</td>
                  <td>{fmtDuration(p.active_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 text-on-surface-variant">
      <span className="inline-flex items-center gap-1.5">
        {color && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-semibold text-on-surface tabular-nums">{value}</span>
    </p>
  );
}

// ---------- desgloses ----------
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 sm:p-6 print:break-inside-avoid">
      <h2 className="text-title-md font-bold text-on-surface">{title}</h2>
      {description && <p className="mt-0.5 mb-4 text-body-sm text-neutral-muted">{description}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-canvas-cream px-4 py-8 text-center text-body-sm text-neutral-muted">
      {children}
    </p>
  );
}

/** Magnitud por categoría: barras de un solo tono, valor y porcentaje sobre el total (base explícita). */
function Bars({
  rows,
  labels,
  unit,
  empty,
  sortByValue = true,
}: {
  rows: { key: string; value: number }[];
  labels?: Record<string, string>;
  unit: string;
  empty: string;
  sortByValue?: boolean;
}) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (!total) return <Empty>{empty}</Empty>;
  const max = Math.max(...rows.map((r) => r.value));
  const list = sortByValue ? [...rows].sort((a, b) => b.value - a.value) : rows;
  return (
    <div>
      <ul className="flex flex-col gap-3">
        {list.map((r) => (
          <li key={r.key} className="text-body-sm">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-on-surface" title={labels?.[r.key] ?? r.key}>
                {labels?.[r.key] ?? r.key}
              </span>
              <span className="shrink-0 text-on-surface-variant tabular-nums">
                <b className="text-on-surface">{fmtInt(r.value)}</b> · {fmtPct(r.value / total)}
              </span>
            </div>
            <span className="block h-2 rounded-full bg-canvas-cream" aria-hidden="true">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0, background: C.main }}
              />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-label-sm text-neutral-muted">
        Base: {fmtInt(total)} {unit}
      </p>
    </div>
  );
}

const asRows = (rows: { key: string; page_views: number }[]) =>
  rows.map((r) => ({ key: r.key, value: r.page_views }));

function Breakdowns({ data }: { data: Overview }) {
  const nav = data.navigation;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4 print:grid-cols-2">
      <Panel title="Procedencia" description="De dónde llegan los lectores.">
        <Bars
          rows={asRows(data.sources)}
          labels={SOURCE}
          unit="visualizaciones"
          empty="Sin visualizaciones."
        />
        <p className="mt-2 text-label-sm text-neutral-muted">
          Entraron al portal por una noticia: {fmtInt(nav.entries)} · llegaron desde otra noticia:{' '}
          {fmtInt(nav.from_other_news)}
        </p>
        {data.referrers.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-label-md font-semibold text-secondary">
              Sitios de referencia
            </summary>
            <div className="mt-3">
              <Bars rows={asRows(data.referrers)} unit="con sitio de referencia" empty="" />
            </div>
          </details>
        )}
      </Panel>
      <Panel title="Dispositivos" description="Desde dónde se lee.">
        <Bars
          rows={asRows(data.devices)}
          labels={DEVICE}
          unit="visualizaciones"
          empty="Sin visualizaciones."
        />
        <details className="mt-3">
          <summary className="cursor-pointer text-label-md font-semibold text-secondary">
            Navegador y sistema operativo
          </summary>
          <div className="mt-3 grid gap-4">
            <Bars rows={asRows(data.browsers)} unit="visualizaciones" empty="—" />
            <Bars rows={asRows(data.os)} unit="visualizaciones" empty="—" />
          </div>
        </details>
      </Panel>
      <Panel title="Compartidos por canal" description="Clics en los botones de compartir del portal.">
        <Bars
          rows={data.channels.map((c) => ({ key: c.key, value: c.shares }))}
          labels={CHANNEL}
          unit="clics en compartir"
          empty="Nadie usó las opciones de compartir en este periodo."
        />
      </Panel>
      <Panel title="Tiempo de lectura" description="Atención activa por visualización.">
        <Bars
          rows={asRows(data.read_distribution)}
          unit="visualizaciones"
          empty="Sin visualizaciones."
          sortByValue={false}
        />
        <p className="mt-2 text-label-sm text-neutral-muted">
          Acumulado: {fmtDuration(data.totals.active_seconds)} · por sesión:{' '}
          {fmtDuration(data.totals.avg_active_per_session)}
        </p>
      </Panel>
    </div>
  );
}

// ---------- rendimiento por noticia ----------
type View = {
  key: string;
  label: string;
  sort: RankingSort;
  order: 'asc' | 'desc';
  minViews?: number;
  empty: string;
};
const VIEWS: View[] = [
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
const COLUMNS: { sort: RankingSort; label: string; value: (r: RankingRow) => ReactNode }[] = [
  { sort: 'visitors', label: 'Visitantes (est.)', value: (r) => fmtInt(r.visitors) },
  { sort: 'avg_active', label: 'Lectura prom.', value: (r) => fmtDuration(r.avg_active) },
  { sort: 'engaged_rate', label: 'Comprometida', value: (r) => fmtPct(r.engaged_rate, 0) },
  { sort: 'shares', label: 'Compartidos', value: (r) => fmtInt(r.shares) },
  {
    sort: 'growth',
    label: 'Variación',
    value: (r) => (
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-label-sm font-bold ${
          r.growth > 0
            ? 'bg-secondary/10 text-secondary'
            : r.growth < 0
              ? 'bg-error/10 text-error'
              : 'text-neutral-muted'
        }`}
      >
        {r.growth > 0 ? '+' : ''}
        {fmtInt(r.growth)}
      </span>
    ),
  },
];
const PAGE = 10;

function Performance({ filter, total }: { filter: StatsFilter; total: number }) {
  const [view, setView] = useState(VIEWS[0]!);
  const [sort, setSort] = useState<RankingSort>('views');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [params] = useSearchParams();
  const minViews = view.minViews ?? 0;
  const q = useQuery({
    queryKey: ['news-admin', 'analytics', 'ranking', filter, sort, order, page, minViews],
    queryFn: () =>
      analyticsApi.ranking({ ...filter, sort, order, page, page_size: PAGE, min_views: minViews }),
    placeholderData: keepPreviousData,
    ...liveRefresh(filter, 60_000),
  });
  const pick = (v: View) => {
    setView(v);
    setSort(v.sort);
    setOrder(v.order);
    setPage(1);
  };
  const toggle = (s: RankingSort) => {
    setOrder(s === sort && order === 'desc' ? 'asc' : 'desc');
    setSort(s);
    setPage(1);
  };
  const descending = order === 'desc';
  const header = (s: RankingSort, label: string, align = 'text-right') => (
    <th
      key={s}
      scope="col"
      aria-sort={sort === s ? (descending ? 'descending' : 'ascending') : 'none'}
      className={`py-3 pr-4 font-semibold ${align}`}
    >
      <button
        type="button"
        onClick={() => toggle(s)}
        className="inline-flex items-center gap-1 hover:text-on-surface"
      >
        {label}
        {sort === s && <Icon name={descending ? 'expand_more' : 'expand_less'} className="text-[16px]" />}
      </button>
    </th>
  );
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-container-lowest print:break-inside-avoid">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle px-5 pt-5 sm:px-6">
        <div className="pb-3">
          <h2 className="text-title-md font-bold text-on-surface">Rendimiento por noticia</h2>
          <p className="text-body-sm text-neutral-muted">
            Noticias publicadas con sus métricas del periodo. «Variación»: visualizaciones menos las del
            periodo anterior.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Vista del ranking"
          className="-mb-px flex flex-wrap gap-1 print:hidden"
        >
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view.key === v.key}
              onClick={() => pick(v)}
              className={`border-b-2 px-3 pb-3 text-label-md font-semibold transition-colors ${
                view.key === v.key
                  ? 'border-secondary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 sm:p-6" role="tabpanel" aria-label={view.label}>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorLine error={q.error} />
        ) : !q.data.items.length ? (
          <Empty>
            {view.empty}
            {view.minViews ? ` (mínimo ${view.minViews} visualizaciones).` : ''}
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-body-sm">
                <thead className="text-label-sm text-neutral-muted">
                  <tr>
                    <th scope="col" className="w-10 py-3 pr-2 font-semibold">
                      #
                    </th>
                    {header('title', 'Noticia', 'text-left')}
                    {header('views', 'Visualizaciones', 'text-left')}
                    {COLUMNS.map((c) => header(c.sort, c.label))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {q.data.items.map((r, i) => (
                    <tr key={r.id} className="border-t border-border-subtle hover:bg-canvas-cream/60">
                      <td className="py-3 pr-2 text-label-md font-bold text-neutral-muted">
                        {(page - 1) * PAGE + i + 1}
                      </td>
                      <td className="max-w-[22rem] py-3 pr-4">
                        <Link
                          to={`${ROOT}/${r.id}/estadisticas?${params}`}
                          className="line-clamp-2 font-semibold text-on-surface hover:text-secondary hover:underline"
                        >
                          {r.title}
                        </Link>
                        <span className="text-label-sm text-neutral-muted">
                          Publicada {fmtDate(r.published_at)}
                        </span>
                      </td>
                      <td className="w-56 pr-4">
                        <div className="flex items-center gap-3">
                          <b className="w-14 text-on-surface">{fmtInt(r.views)}</b>
                          <span className="h-1.5 flex-1 rounded-full bg-canvas-cream" aria-hidden="true">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${total ? (r.views / total) * 100 : 0}%`, background: C.main }}
                            />
                          </span>
                          <span className="w-12 text-right text-label-sm text-neutral-muted">
                            {total ? fmtPct(r.views / total, 0) : '—'}
                          </span>
                        </div>
                      </td>
                      {COLUMNS.map((c) => (
                        <td key={c.sort} className="pr-4 text-right">
                          {c.value(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              total={q.data.total}
              limit={PAGE}
              offset={(page - 1) * PAGE}
              onChange={(o) => setPage(o / PAGE + 1)}
            />
          </>
        )}
      </div>
    </section>
  );
}

function Definitions({ minViews }: { minViews: number }) {
  return (
    <details className="rounded-2xl border border-border-subtle bg-surface-container-lowest p-5 text-body-sm text-on-surface-variant print:hidden">
      <summary className="cursor-pointer font-semibold text-on-surface">Metodología: ¿cómo se mide?</summary>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>
          <b>Visualización</b> (dato registrado): una noticia abierta en una sesión. Recargar no suma. Se
          excluyen bots, noticias no publicadas y lectores que no autorizaron la analítica.
        </li>
        <li>
          <b>Sesión</b>: una pestaña del navegador mientras está abierta (identificador aleatorio, sin
          cookies).
        </li>
        <li>
          <b>Visitantes únicos</b> (estimado): seudónimo diario que no identifica a nadie; en varios días es
          la suma de los únicos de cada día.
        </li>
        <li>
          <b>Lectura</b> (calculado): tiempo con actividad real y la pestaña visible, medido por el servidor
          cada 15 s. Comprometida = 30 s o más.
        </li>
        <li>
          <b>Compartidos</b>: clics en las opciones de compartir; no es posible saber si se publicaron.
        </li>
        <li>
          Los promedios por noticia se ordenan con al menos {minViews} visualizaciones. Las variaciones
          comparan con el periodo anterior de igual duración.
        </li>
      </ul>
    </details>
  );
}

/** Pie del informe impreso: cuándo se generó y con qué periodo (solo en papel/PDF). */
function PrintFooter({ data }: { data: Overview }) {
  return (
    <p className="hidden text-label-sm text-neutral-muted print:block">
      Informe generado el {new Date().toLocaleString('es-CO')} · Periodo{' '}
      {fmtRange(data.period.start, data.period.end)} · Portal de investigación, Universidad Simón Bolívar.
    </p>
  );
}

// ---------- exportar ----------
async function exportCsv(filter: StatsFilter) {
  const rows: RankingRow[] = [];
  for (let page = 1; ; page++) {
    const r = await analyticsApi.ranking({ ...filter, sort: 'views', order: 'desc', page, page_size: 100 });
    rows.push(...r.items);
    if (rows.length >= r.total || !r.items.length) break;
  }
  const head = [
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
  // BOM + «;»: Excel en español lo abre con tildes y columnas correctas.
  const blob = new Blob(['﻿' + [head.map(cell).join(';'), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `estadisticas-noticias_${filter.start_date}_${filter.end_date}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- vistas ----------
export function AnalyticsView() {
  const { filter } = useStatsFilter();
  const q = useQuery({
    queryKey: ['news-admin', 'analytics', 'overview', filter],
    queryFn: () => analyticsApi.overview(filter),
    placeholderData: keepPreviousData,
    ...liveRefresh(filter, 60_000),
  });
  const d: GeneralStats | undefined = q.data;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-title-lg font-bold tracking-tight text-on-surface">Estadísticas de noticias</h1>
        <p className="text-body-sm text-on-surface-variant">
          Alcance, lectura y circulación de las noticias publicadas en el portal.
          {q.isFetching && d && <span className="ml-2 text-neutral-muted">Actualizando…</span>}
        </p>
      </header>
      <Toolbar onExport={() => void exportCsv(filter)} />
      {q.isPending ? (
        <Loading what="Calculando estadísticas" />
      ) : q.isError ? (
        <ErrorLine error={q.error} />
      ) : d ? (
        <>
          <Summary
            title="Así se leyeron las noticias"
            data={d}
            insights={insightsFor(d, d.top.views[0])}
            filter={filter}
          />
          <KpiStrip data={d} items={GENERAL_KPIS} />
          <Trend data={d} />
          <Performance filter={filter} total={d.totals.page_views} />
          <Breakdowns data={d} />
          <Definitions minViews={d.min_views_for_averages} />
          <PrintFooter data={d} />
        </>
      ) : null}
    </div>
  );
}

function newsInsights(d: NewsStats): Insight[] {
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

const ACTION =
  'inline-flex h-11 items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-container-lowest px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt';

export function NewsAnalyticsView() {
  const { newsId = '' } = useParams();
  const { filter } = useStatsFilter();
  const [params] = useSearchParams();
  const q = useQuery({
    queryKey: ['news-admin', 'analytics', 'news', newsId, filter],
    queryFn: () => analyticsApi.news(Number(newsId), filter),
    placeholderData: keepPreviousData,
    ...liveRefresh(filter, 60_000),
  });
  const d = q.data;
  const c = d?.comparison;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <nav aria-label="Ruta de navegación" className="print:hidden">
          <Link
            to={`${ROOT}/estadisticas?${params}`}
            className="inline-flex items-center gap-1 text-label-md font-semibold text-secondary hover:underline"
          >
            <Icon name="chevron_left" className="text-[16px]" /> Estadísticas
          </Link>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-96">
            <h1 className="text-title-lg font-bold tracking-tight text-on-surface">
              {d?.title ?? 'Estadísticas de la noticia'}
            </h1>
            {d && <p className="text-body-sm text-on-surface-variant">Publicada {fmtDate(d.published_at)}</p>}
          </div>
          {d && (
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link to={`${ROOT}/${newsId}`} className={ACTION}>
                <Icon name="edit_note" className="text-[18px]" /> Editar
              </Link>
              {d.status === 'published' && (
                <Link to={`/noticias/${d.slug}`} className={ACTION}>
                  <Icon name="open_in_new" className="text-[18px]" /> Ver en el portal
                </Link>
              )}
            </div>
          )}
        </div>
      </header>
      <Toolbar withNewsFilters={false} />
      {q.isPending ? (
        <Loading what="Calculando estadísticas" />
      ) : q.isError ? (
        <ErrorLine error={q.error} />
      ) : d ? (
        <>
          <Summary
            title="Así se leyó esta noticia"
            data={d}
            insights={newsInsights(d)}
            filter={filter}
            newsId={Number(newsId)}
          />
          <KpiStrip data={d} items={NEWS_KPIS} />
          <Trend data={d} />
          <Panel
            title="Frente a las demás noticias del periodo"
            description="Noticias con al menos una visualización en el mismo periodo."
          >
            {c ? (
              <dl className="grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-3">
                <Stat
                  label="Supera en visualizaciones a"
                  value={`${c.percentile} % de ${fmtInt(c.peers)} noticias`}
                />
                <Stat
                  label="Visualizaciones promedio de las demás"
                  value={`${fmtInt(c.peer_avg_views)} (esta: ${fmtInt(d.news?.views ?? 0)})`}
                />
                <Stat
                  label="Lectura promedio de las demás"
                  value={`${fmtDuration(c.peer_avg_active)} (esta: ${fmtDuration(d.totals.avg_active_per_view)})`}
                />
              </dl>
            ) : (
              <Empty>
                No hay suficientes noticias con visualizaciones en este periodo para una comparación válida
                (mínimo {d.min_views_for_averages}).
              </Empty>
            )}
          </Panel>
          <Breakdowns data={d} />
          <Definitions minViews={d.min_views_for_averages} />
          <PrintFooter data={d} />
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-canvas-cream p-4">
      <dt className="text-label-sm text-neutral-muted">{label}</dt>
      <dd className="mt-1 text-body-md font-semibold text-on-surface tabular-nums">{value}</dd>
    </div>
  );
}
