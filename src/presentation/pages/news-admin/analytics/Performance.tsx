import { useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import {
  analyticsApi,
  type RankingRow,
  type RankingSort,
  type StatsFilter,
} from '@/infrastructure/news/analytics-api';
import { Icon } from '@/presentation/components/ui/Icon';
import { ErrorLine, Loading, Pager, ROOT, fmtDate } from '../ui';
import { C, fmtDuration, fmtInt, fmtPct } from './format';
import { Empty } from './panels';
import { PAGE, VIEWS, emptyMessage, growthTone, nextOrder, viewsShare, type View } from './performance-model';
import { liveRefresh } from './use-stats-filter';

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
        className={`inline-flex rounded-full px-2 py-0.5 text-label-sm font-bold ${growthTone(r.growth)}`}
      >
        {r.growth > 0 ? '+' : ''}
        {fmtInt(r.growth)}
      </span>
    ),
  },
];

export function Performance({ filter, total }: { filter: StatsFilter; total: number }) {
  const [view, setView] = useState(VIEWS[0]!);
  const [sort, setSort] = useState<RankingSort>('views');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
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
    setOrder(nextOrder({ sort, order }, s));
    setSort(s);
    setPage(1);
  };
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
        <ViewTabs active={view.key} onPick={pick} />
      </div>
      <div className="p-5 sm:p-6" role="tabpanel" aria-label={view.label}>
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorLine error={q.error} />
        ) : !q.data.items.length ? (
          <Empty>{emptyMessage(view)}</Empty>
        ) : (
          <>
            <RankingTable
              items={q.data.items}
              total={total}
              page={page}
              sort={sort}
              descending={order === 'desc'}
              onSort={toggle}
            />
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

function ViewTabs({ active, onPick }: { active: string; onPick: (v: View) => void }) {
  return (
    <div role="tablist" aria-label="Vista del ranking" className="-mb-px flex flex-wrap gap-1 print:hidden">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={active === v.key}
          onClick={() => onPick(v)}
          className={`border-b-2 px-3 pb-3 text-label-md font-semibold transition-colors ${
            active === v.key
              ? 'border-secondary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

interface TableProps {
  items: RankingRow[];
  total: number;
  page: number;
  sort: RankingSort;
  descending: boolean;
  onSort: (sort: RankingSort) => void;
}

function RankingTable({ items, total, page, sort, descending, onSort }: TableProps) {
  const [params] = useSearchParams();
  const header = (s: RankingSort, label: string, align = 'text-right') => (
    <th
      key={s}
      scope="col"
      aria-sort={sort === s ? (descending ? 'descending' : 'ascending') : 'none'}
      className={`py-3 pr-4 font-semibold ${align}`}
    >
      <button
        type="button"
        onClick={() => onSort(s)}
        className="inline-flex items-center gap-1 hover:text-on-surface"
      >
        {label}
        {sort === s && <Icon name={descending ? 'expand_more' : 'expand_less'} className="text-[16px]" />}
      </button>
    </th>
  );
  return (
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
          {items.map((r, i) => (
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
                <span className="text-label-sm text-neutral-muted">Publicada {fmtDate(r.published_at)}</span>
              </td>
              <td className="w-56 pr-4">
                <div className="flex items-center gap-3">
                  <b className="w-14 text-on-surface">{fmtInt(r.views)}</b>
                  <span className="h-1.5 flex-1 rounded-full bg-canvas-cream" aria-hidden="true">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${viewsShare(r.views, total)}%`, background: C.main }}
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
  );
}
