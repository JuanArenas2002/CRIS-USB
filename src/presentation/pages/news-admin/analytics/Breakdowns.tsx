import type { Overview } from '@/infrastructure/news/analytics-api';
import { CHANNEL, DEVICE, SOURCE, fmtDuration, fmtInt } from './format';
import { Bars, Panel } from './panels';

const asRows = (rows: { key: string; page_views: number }[]) =>
  rows.map((r) => ({ key: r.key, value: r.page_views }));

export function Breakdowns({ data }: { data: Overview }) {
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
