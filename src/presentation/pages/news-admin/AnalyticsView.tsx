import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router';
import { analyticsApi, type GeneralStats } from '@/infrastructure/news/analytics-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { ErrorLine, Loading, ROOT, fmtDate } from './ui';
import { Breakdowns } from './analytics/Breakdowns';
import { fmtDuration, fmtInt } from './analytics/format';
import { insightsFor, newsInsights } from './analytics/insights';
import { GENERAL_KPIS, NEWS_KPIS } from './analytics/kpis';
import { KpiStrip } from './analytics/KpiStrip';
import { Empty, Panel } from './analytics/panels';
import { Performance } from './analytics/Performance';
import { Definitions, PrintFooter } from './analytics/ReportNotes';
import { exportCsv } from './analytics/report-csv';
import { Summary } from './analytics/Summary';
import { Toolbar } from './analytics/Toolbar';
import { Trend } from './analytics/Trend';
import { liveRefresh, useStatsFilter } from './analytics/use-stats-filter';

/**
 * Estadísticas de noticias, en formato de informe ejecutivo:
 *   1. resumen en lenguaje natural + lo que pasa en vivo;
 *   2. franja de indicadores con variación y tendencia;
 *   3. evolución frente al periodo anterior;
 *   4. rendimiento por noticia (una tabla, varias lecturas);
 *   5. procedencia, dispositivos, canales y lectura.
 * Todo sale del backend (agregado en PostgreSQL). Conteos registrados sin marca; «Estimado» y «Calculado»
 * marcados. Los filtros viven en la URL. «Imprimir informe» produce un PDF limpio (sin navegación).
 * Cada bloque vive en ./analytics; aquí solo se ensamblan las dos vistas.
 */

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
