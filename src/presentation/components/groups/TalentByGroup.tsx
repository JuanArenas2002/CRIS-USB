import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug } from '@/domain/authors/author';
import { hasPublicDetail, type Group } from '@/domain/groups/group';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { useGroupStaffing } from '@/presentation/hooks/use-groups';
import { useLabels } from '@/presentation/hooks/use-labels';

export const SITES = [
  ['Barranquilla', 'bg-[#4F8BD0]'],
  ['Cúcuta', 'bg-[#E3A008]'],
] as const;
type Site = (typeof SITES)[number][0];
type Sort = 'total' | Site | 'name';
const OTHER = 'bg-[#C7CCD4]';
const TOP = 10;

/** Investigadores (vinculados) por grupo y sede: resumen, orden, filtro por sede y barras apiladas. */
export function TalentByGroup({ groups, tone }: { groups: Group[]; tone: (c: string | null) => string }) {
  const { t } = useTranslation('groups');
  const { number } = useLabels();
  const staffing = useGroupStaffing();
  const [hidden, setHidden] = useState<ReadonlySet<Site>>(new Set());
  const [sort, setSort] = useState<Sort>('total');
  const [all, setAll] = useState(false);

  const by = new Map((staffing.data ?? []).map((s) => [s.groupId, s]));
  // Lo que se ve de cada grupo: sedes visibles + "sin sede" (solo si no hay filtro activo).
  const rows = groups.flatMap((g) => {
    const s = by.get(g.id);
    if (!s?.contracted) return [];
    const sites = SITES.map(([n]) => (hidden.has(n) ? 0 : (s.bySite[n] ?? 0)));
    const other = hidden.size ? 0 : s.contracted - SITES.reduce((a, [n]) => a + (s.bySite[n] ?? 0), 0);
    return [{ g, sites, other, total: sites.reduce((a, b) => a + b, 0) + other }];
  });
  const siteIdx = (n: Site) => SITES.findIndex(([x]) => x === n);
  rows.sort((a, b) =>
    sort === 'name'
      ? a.g.name.localeCompare(b.g.name, 'es')
      : sort === 'total'
        ? b.total - a.total
        : b.sites[siteIdx(sort)]! - a.sites[siteIdx(sort)]! || b.total - a.total,
  );
  const visible = all ? rows : rows.slice(0, TOP);
  const step = Math.max(1, Math.ceil(Math.max(1, ...rows.map((r) => r.total)) / 4));
  const max = step * 4;

  const grand = (staffing.data ?? []).reduce((a, s) => a + s.contracted, 0);
  const perSite = SITES.map(([n]) => (staffing.data ?? []).reduce((a, s) => a + (s.bySite[n] ?? 0), 0));
  const pct = (n: number) => `${grand ? Math.round((n / grand) * 100) : 0}%`;

  const toggle = (n: Site) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(n)) next.add(n);
      return next;
    });

  return (
    <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm ring-1 ring-border-subtle md:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h3 className="text-headline-sm font-bold text-primary">{t('overview.staffTitle')}</h3>
          <p className="max-w-2xl text-body-sm text-on-surface-variant">{t('overview.staffLead')}</p>
        </div>
        <div
          role="group"
          aria-label={t('overview.sortBy')}
          className="inline-flex shrink-0 self-start rounded-lg bg-canvas-cream p-1 text-label-sm font-semibold"
        >
          {(['total', ...SITES.map(([n]) => n), 'name'] as Sort[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={sort === k}
              onClick={() => setSort(k)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                sort === k
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {k === 'total' ? t('overview.sortTotal') : k === 'name' ? t('overview.sortName') : k}
            </button>
          ))}
        </div>
      </div>

      {staffing.data ? (
        <>
          <div className="mt-5 grid gap-4 rounded-xl bg-canvas-cream/60 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex gap-6">
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase">{t('overview.contracted')}</p>
                <p className="text-stat-metric font-bold text-primary tabular-nums">{number(grand)}</p>
              </div>
              {SITES.map(([n, color], i) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={!hidden.has(n)}
                  onClick={() => toggle(n)}
                  title={t('overview.toggleSite', { site: n })}
                  className={`rounded-lg px-2 text-left transition-opacity hover:bg-surface-container-lowest ${
                    hidden.has(n) ? 'opacity-40' : ''
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant uppercase">
                    <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${color}`} /> {n}
                  </p>
                  <p className="text-stat-metric font-bold text-primary tabular-nums">
                    {number(perSite[i]!)}{' '}
                    <span className="text-label-md font-semibold text-on-surface-variant">
                      {pct(perSite[i]!)}
                    </span>
                  </p>
                </button>
              ))}
            </div>
            <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-surface-container-lowest">
              {SITES.map(([n, color], i) => (
                <span
                  key={n}
                  className={`${color} transition-[flex-grow] duration-500`}
                  style={{ flexGrow: perSite[i] }}
                />
              ))}
              <span className={OTHER} style={{ flexGrow: grand - perSite.reduce((a, b) => a + b, 0) }} />
            </div>
          </div>

          {/* ponytail: tabla nativa + barras apiladas con flex/CSS, sin librería de gráficos. */}
          <div className="mt-6 overflow-x-auto rounded-xl ring-1 ring-border-subtle">
            <table className="w-full min-w-[760px] border-collapse text-body-sm">
              <thead className="bg-canvas-cream text-label-sm text-on-surface-variant uppercase">
                <tr className="border-b border-border-subtle">
                  <th scope="col" className="w-10 px-3 py-2.5 text-center font-semibold">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                    {t('card.colGroup')}
                  </th>
                  {SITES.map(([n, color]) => (
                    <th
                      key={n}
                      scope="col"
                      className="w-28 border-l border-border-subtle px-3 py-2.5 text-center font-semibold"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className={`h-2 w-2 rounded-full ${color}`} /> {n}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="w-[38%] border-l border-border-subtle px-3 py-2.5 font-semibold">
                    <span className="sr-only">{t('overview.distribution')}</span>
                    <span aria-hidden className="relative block h-4 normal-case tabular-nums">
                      {[0, 1, 2, 3, 4].map((k) => (
                        <span
                          key={k}
                          className={`absolute ${k === 0 ? '' : k === 4 ? '-translate-x-full' : '-translate-x-1/2'}`}
                          style={{ left: `${k * 25}%` }}
                        >
                          {number(k * step)}
                        </span>
                      ))}
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="w-20 border-l border-border-subtle px-3 py-2.5 text-center font-semibold"
                  >
                    {t('overview.sortTotal')}
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {visible.map(({ g, sites, other, total }, i) => (
                  <tr
                    key={g.id}
                    className="group border-b border-border-subtle transition-colors last:border-b-0 even:bg-canvas-cream/40 hover:bg-canvas-cream"
                  >
                    <td className="px-3 py-2 text-center text-label-sm font-semibold text-on-surface-variant">
                      {i + 1}
                    </td>
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`w-8 shrink-0 rounded-md text-center text-label-sm ${tone(g.category)}`}
                        >
                          {g.category ?? '—'}
                        </span>
                        {hasPublicDetail(g) ? (
                          <Link
                            to={`/grupos/${authorSlug(g)}`}
                            className="line-clamp-2 text-primary hover:underline"
                          >
                            {g.name}
                          </Link>
                        ) : (
                          <span className="line-clamp-2">{g.name}</span>
                        )}
                      </span>
                    </th>
                    {SITES.map(([n], k) => (
                      <td key={n} className="border-l border-border-subtle px-3 py-2 text-center">
                        {hidden.has(n) ? '—' : number(sites[k]!)}
                      </td>
                    ))}
                    <td className="border-l border-border-subtle px-3 py-2">
                      <span className="relative block h-5">
                        <span aria-hidden className="absolute inset-0 flex justify-between">
                          {[0, 1, 2, 3, 4].map((k) => (
                            <span key={k} className="h-full border-l border-dashed border-border-subtle" />
                          ))}
                        </span>
                        <span
                          className="bar-grow relative flex h-full origin-left overflow-hidden rounded-sm transition-[width] duration-500 group-hover:shadow-md motion-reduce:animate-none motion-reduce:transition-none"
                          style={{ width: `${(total / max) * 100}%`, animationDelay: `${i * 40}ms` }}
                        >
                          {[
                            ...SITES.map(([n, color], k) => [n, color, sites[k]!] as const),
                            [t('overview.noSite'), OTHER, other] as const,
                          ].map(([n, color, v]) =>
                            v ? (
                              <span
                                key={n}
                                title={`${n}: ${number(v)}`}
                                className={`transition-[flex-grow] duration-500 ${color}`}
                                style={{ flexGrow: v }}
                              />
                            ) : null,
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="border-l border-border-subtle px-3 py-2 text-center font-bold text-primary">
                      {number(total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > TOP ? (
            <button
              type="button"
              onClick={() => setAll(!all)}
              aria-expanded={all}
              className="mt-3 text-label-md font-semibold text-secondary hover:underline"
            >
              {all ? t('overview.showLess') : t('overview.showAll', { count: rows.length })}
            </button>
          ) : null}
        </>
      ) : staffing.isError ? (
        <ErrorState error={staffing.error} onRetry={() => staffing.refetch()} />
      ) : (
        <div
          aria-busy="true"
          className="mt-4 h-64 animate-pulse rounded-xl bg-canvas-cream motion-reduce:animate-none"
        />
      )}
    </section>
  );
}
