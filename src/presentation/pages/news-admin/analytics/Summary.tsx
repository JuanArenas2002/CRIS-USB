// Resumen ejecutivo (conclusiones en lenguaje natural) y, a su lado, lo que pasa en vivo.
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import {
  analyticsApi,
  type LiveStats,
  type Overview,
  type StatsFilter,
} from '@/infrastructure/news/analytics-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { ROOT } from '../ui';
import { fmtInt, fmtRange } from './format';
import type { Insight } from './insights';
import { liveRefresh, today } from './use-stats-filter';

function Live({ filter, newsId }: { filter: StatsFilter; newsId?: number }) {
  const live = filter.end_date === today();
  const q = useQuery({
    queryKey: ['news-admin', 'analytics', 'live', filter, newsId],
    queryFn: () => analyticsApi.live(filter, newsId),
    enabled: live,
    ...liveRefresh(filter, 10_000),
  });
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
      <LiveBody live={live} isError={q.isError} data={q.data} updatedAt={q.dataUpdatedAt} newsId={newsId} />
    </section>
  );
}

function LiveBody({
  live,
  isError,
  data,
  updatedAt,
  newsId,
}: {
  live: boolean;
  isError: boolean;
  data: LiveStats | undefined;
  updatedAt: number;
  newsId?: number;
}) {
  const [params] = useSearchParams();
  if (!live)
    return (
      <p className="text-body-sm text-primary-fixed-dim">
        Los datos de un periodo pasado no cambian. Elige un periodo que incluya hoy para verlos en vivo.
      </p>
    );
  if (isError) return <p className="text-body-sm text-error-container">No se pudo actualizar.</p>;
  if (!data) return <p className="text-body-sm text-primary-fixed-dim">Cargando…</p>;
  return (
    <>
      <p className="text-body-sm text-primary-fixed-dim" aria-live="polite">
        <span className="block text-[2.5rem] leading-none font-bold text-on-primary tabular-nums">
          {fmtInt(data.active_readers)}
        </span>{' '}
        {data.active_readers === 1 ? 'persona leyendo' : 'personas leyendo'} ahora
      </p>
      <p className="text-body-sm text-primary-fixed-dim">
        <b className="text-on-primary tabular-nums">{fmtInt(data.views_last_30_min)}</b> visualizaciones en
        los últimos 30 min
      </p>
      {!newsId && data.reading_now.length > 0 && (
        <p className="min-w-0 text-body-sm text-primary-fixed-dim">
          Más leída ahora:{' '}
          <Link
            to={`${ROOT}/${data.reading_now[0]!.id}/estadisticas?${params}`}
            className="font-semibold text-on-primary underline underline-offset-2"
          >
            {data.reading_now[0]!.title}
          </Link>
        </p>
      )}
      <p
        className="mt-auto text-label-sm text-primary-fixed-dim"
        title="Se actualiza cada 10 s; el resto del informe, cada minuto"
      >
        Actualizado {new Date(updatedAt).toLocaleTimeString('es-CO')}
      </p>
    </>
  );
}

export function Summary({
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
