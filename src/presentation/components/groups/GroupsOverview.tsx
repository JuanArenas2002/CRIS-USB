import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { authorSlug } from '@/domain/authors/author';
import { CATEGORY_ORDER, TRAJECTORY_CATEGORIES, hasPublicDetail, type Group } from '@/domain/groups/group';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { useGroupStaffing, useGroupTrajectory } from '@/presentation/hooks/use-groups';
import { useLabels } from '@/presentation/hooks/use-labels';
import { TalentByGroup } from '@/presentation/components/groups/TalentByGroup';

const card = 'rounded-2xl bg-surface-container-lowest p-5 shadow-sm ring-1 ring-border-subtle md:p-6';
const kicker = 'text-label-md font-semibold tracking-wide text-on-surface-variant uppercase';
/** Últimas convocatorias en el gráfico, como en Metri-K. */
const LAST = 5;
/** Paleta propia de la vista estadística (el resto del portal usa la escala verde de category-tone). */
const TONE: Record<string, string> = {
  A1: 'bg-[#2FB386] text-white',
  A: 'bg-[#E3A008] text-[#3B2A00]',
  B: 'bg-[#4F8BD0] text-white',
  C: 'bg-[#F06B7E] text-white',
  D: 'bg-[#F9C6D0] text-[#7A2433]',
  RECONOCIDO: 'bg-[#9CA3AF] text-white',
};
const tone = (c: string | null | undefined) =>
  TONE[(c ?? '').trim().toUpperCase()] ?? 'bg-surface-cream-alt text-neutral-muted';

/** Panorama de los grupos activos + distribución por convocatoria (con detalle al hacer clic). */
export function GroupsOverview({ groups }: { groups: Group[] }) {
  const { t } = useTranslation('groups');
  const { number, domain, convocation } = useLabels();
  const trajectory = useGroupTrajectory(true);
  const staffing = useGroupStaffing();
  const totalContracted = (staffing.data ?? []).reduce((a, s) => a + s.contracted, 0);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const label = (c: string) => domain(c === 'RECONOCIDO' ? 'Reconocido' : c);
  const pct = (n: number) => `${groups.length ? ((n / groups.length) * 100).toFixed(1) : '0'}%`;
  const count = (c: string) => groups.filter((g) => g.category === c).length;
  const top = count('A1') + count('A');
  const centers = new Set(groups.flatMap((g) => g.centerIds ?? [])).size;
  const byId = new Map(groups.filter(hasPublicDetail).map((g) => [g.id, g]));

  const rows = (trajectory.data ?? []).slice(-LAST);
  const shown = TRAJECTORY_CATEGORIES.filter((c) => !hidden.has(c) && rows.some((r) => r.counts[c]));
  const rawMax = Math.max(1, ...rows.flatMap((r) => shown.map((c) => r.counts[c] ?? 0)));
  const step = Math.max(1, Math.ceil(rawMax / 4));
  const max = step * 4;
  const detail = rows.find((r) => r.convocation === selected);

  const toggle = (c: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (!next.delete(c)) next.add(c);
      return next;
    });

  const download = () => {
    const head = [t('overview.colConvocation'), ...TRAJECTORY_CATEGORIES.map(label)];
    const lines = (trajectory.data ?? []).map((r) => [
      convocation(r.convocation),
      ...TRAJECTORY_CATEGORIES.map((c) => r.counts[c] ?? 0),
    ]);
    const csv = [head, ...lines]
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'grupos-por-convocatoria.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-gutter">
      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <section className={card}>
          <div className="flex justify-between">
            <h3 className={kicker}>{t('overview.total')}</h3>
            <Icon name="groups" className="text-[20px] text-on-surface-variant" />
          </div>
          <p className="mt-2 text-stat-metric font-bold text-primary">{number(groups.length)}</p>
          <p className="text-body-sm text-on-surface-variant">{t('overview.totalHint')}</p>
        </section>

        <section className={card}>
          <div className="flex justify-between">
            <h3 className={kicker}>{t('overview.byCategory')}</h3>
            <Icon name="workspace_premium" className="text-[20px] text-on-surface-variant" />
          </div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {CATEGORY_ORDER.map((c) => (
              <li key={c} className="grid grid-cols-[2.5rem_1fr_2rem_3rem] items-center gap-3 text-body-sm">
                <span
                  className={`rounded-full px-2 py-0.5 text-center text-label-sm font-semibold ${tone(c)}`}
                >
                  {c}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-canvas-cream">
                  <span
                    className={`bar-grow block h-full origin-left rounded-full motion-reduce:animate-none ${tone(c)}`}
                    style={{ width: pct(count(c)) }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums">{number(count(c))}</span>
                <span className="text-right text-label-sm text-on-surface-variant tabular-nums">
                  {pct(count(c))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card}>
          <div className="flex justify-between">
            <h3 className={kicker}>{t('overview.centers')}</h3>
            <Icon name="corporate_fare" className="text-[20px] text-on-surface-variant" />
          </div>
          <p className="mt-2 text-stat-metric font-bold text-primary">{number(centers)}</p>
          <p className="text-body-sm text-on-surface-variant">{t('overview.centersHint')}</p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-gutter lg:grid-cols-3">
        <section className={`${card} grid gap-6 md:grid-cols-[auto_1fr] lg:col-span-2`}>
          <div className="md:border-r md:border-border-subtle md:pr-6">
            <div className="flex justify-between gap-6">
              <h3 className={kicker}>{t('overview.top')}</h3>
              <Icon name="military_tech" className="text-[20px] text-on-surface-variant" />
            </div>
            <p className="mt-3 text-display-hero-mobile font-bold text-primary">
              {pct(top).slice(0, -1)}
              <span className="text-headline-sm text-on-surface-variant">%</span>
            </p>
            <p className="text-body-sm text-on-surface-variant">
              {t('overview.topHint', { count: top, total: groups.length })}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-label-sm text-on-surface-variant uppercase">
              <span>{t('overview.composition')}</span>
              <span>{t('overview.ofTotal', { pct: pct(top) })}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-canvas-cream">
              <span className={tone('A1')} style={{ width: pct(count('A1')) }} />
              <span className={tone('A')} style={{ width: pct(count('A')) }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['A1', 'A'] as const).map((c) => (
                <div key={c} className="rounded-xl p-3 ring-1 ring-border-subtle">
                  <p className="flex items-center gap-2 text-label-md font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full ${tone(c)}`} /> {c}
                  </p>
                  <p className="mt-1 text-headline-sm font-bold text-primary">
                    {number(count(c))}{' '}
                    <span className="text-label-sm font-normal text-on-surface-variant">{pct(count(c))}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={card}>
          <div className="flex justify-between">
            <h3 className={kicker}>{t('overview.researchers')}</h3>
            <Icon name="person_search" className="text-[20px] text-on-surface-variant" />
          </div>
          <p className="mt-3 text-display-hero-mobile font-bold text-primary">
            {staffing.data ? number(totalContracted) : '—'}
          </p>
          <p className="text-body-sm text-on-surface-variant">{t('overview.contracted')}</p>
        </section>
      </div>

      <section className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-headline-sm font-bold text-primary">{t('overview.chartTitle')}</h3>
            <p className="text-body-sm text-on-surface-variant">{t('overview.chartLead', { count: LAST })}</p>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={!trajectory.data}
            aria-label={t('overview.download')}
            title={t('overview.download')}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-canvas-cream hover:text-primary disabled:opacity-40"
          >
            <Icon name="download" className="text-[20px]" />
          </button>
        </div>

        {trajectory.data ? (
          <>
            <p className="mt-4 text-body-sm text-on-surface-variant">{t('overview.clickHint')}</p>
            <div className="mt-4 flex gap-2">
              <div className="relative flex h-72 w-8 shrink-0 flex-col-reverse justify-between text-right text-label-sm text-on-surface-variant tabular-nums">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="-my-2">
                    {number(i * step)}
                  </span>
                ))}
              </div>
              <div className="relative flex-1 overflow-x-auto">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 flex h-72 flex-col justify-between"
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="border-t border-dashed border-border-subtle" />
                  ))}
                </div>
                <ul className="relative flex min-w-[640px]">
                  {rows.map((r, i) => (
                    <li key={r.convocation} className="flex-1">
                      <button
                        type="button"
                        aria-pressed={selected === r.convocation}
                        onClick={() => setSelected(selected === r.convocation ? null : r.convocation)}
                        className={`group flex w-full flex-col rounded-lg transition-colors hover:bg-canvas-cream/60 ${
                          selected === r.convocation ? 'bg-canvas-cream' : ''
                        }`}
                      >
                        <span className="flex h-72 items-end justify-center gap-1.5 px-2">
                          {shown.map((c) => {
                            const n = r.counts[c] ?? 0;
                            return (
                              <span key={c} className="flex h-full w-7 flex-col items-center justify-end">
                                {n ? (
                                  <span className="text-label-sm text-on-surface tabular-nums">
                                    {number(n)}
                                  </span>
                                ) : null}
                                <span
                                  title={`${label(c)}: ${number(n)}`}
                                  style={{ height: `${(n / max) * 100}%`, animationDelay: `${i * 80}ms` }}
                                  className={`bar-grow block w-full rounded-t-sm transition-[height] duration-500 motion-reduce:animate-none motion-reduce:transition-none ${tone(c)}`}
                                >
                                  <span className="sr-only">{`${label(c)}: ${number(n)}`}</span>
                                </span>
                              </span>
                            );
                          })}
                        </span>
                        <span className="mt-2 pb-2 text-center text-label-sm text-on-surface-variant">
                          {convocation(r.convocation)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-label-sm">
              {TRAJECTORY_CATEGORIES.filter((c) => rows.some((r) => r.counts[c])).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={!hidden.has(c)}
                  onClick={() => toggle(c)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 hover:bg-canvas-cream ${
                    hidden.has(c) ? 'opacity-40 line-through' : ''
                  }`}
                >
                  <span aria-hidden className={`h-3 w-3 rounded-full ${tone(c)}`} /> {label(c)}
                </button>
              ))}
            </div>

            {detail ? (
              <div className="mt-6 border-t border-border-subtle pt-4">
                <h4 className="mb-3 font-semibold text-primary">
                  {t('overview.detailTitle', {
                    convocation: convocation(detail.convocation),
                    count: detail.groups.length,
                  })}
                </h4>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {detail.groups.map((g) => {
                    const active = byId.get(g.id);
                    return (
                      <li key={g.id} className="flex items-center gap-2 text-body-sm">
                        <span
                          className={`w-12 shrink-0 rounded-md py-0.5 text-center text-label-sm ${tone(g.category)}`}
                        >
                          {g.category === 'RECONOCIDO' ? 'R' : g.category}
                        </span>
                        {active ? (
                          <Link to={`/grupos/${authorSlug(active)}`} className="text-primary hover:underline">
                            {g.name}
                          </Link>
                        ) : (
                          <span className="text-on-surface-variant">{g.name}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        ) : trajectory.isError ? (
          <ErrorState error={trajectory.error} onRetry={() => trajectory.refetch()} />
        ) : (
          <div
            aria-busy="true"
            className="mt-4 h-72 animate-pulse rounded-xl bg-canvas-cream motion-reduce:animate-none"
          />
        )}
      </section>

      <TalentByGroup groups={groups} tone={tone} />
    </div>
  );
}
