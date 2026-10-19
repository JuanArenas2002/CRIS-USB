import { useSearchParams } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';
import { displayName } from '@/domain/authors/author';
import { filterCenters, type Center, type CenterFilters } from '@/domain/centers/center';
import { ODS, type OdsId } from '@/domain/ods/ods';
import {
  CenterCard,
  CenterRow,
  CenterRowHeader,
  centerPath,
} from '@/presentation/components/centers/CenterCard';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { HeroWaves } from '@/presentation/components/layout/HeroWaves';
import { Icon } from '@/presentation/components/ui/Icon';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';

// Mismo estándar visual que GroupsPage: héroe oscuro, buscador flotante, lista/tarjetas y contacto.
const fieldClass =
  'h-11 rounded-xl bg-canvas-cream text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';

/** Sedes presentes en el catálogo (por código DANE). */
const campusesOf = (centers: Center[]) => [
  ...new Map(
    centers.filter((c) => c.daneCode && c.city).map((c) => [c.daneCode!, displayName(c.city!)]),
  ).entries(),
];

export function CentersPage() {
  const { data, isError, error, refetch } = useCenters();
  const { t } = useTranslation(['centers', 'common', 'groups']);
  const labels = useLabels();
  const [params, setParams] = useSearchParams();
  const filters: CenterFilters = {
    search: params.get('q') ?? '',
    campus: params.get('sede'),
    ods: Number(params.get('ods')) || null,
  };
  const view: 'lista' | 'tarjetas' = params.get('vista') === 'tarjetas' ? 'tarjetas' : 'lista';

  const setParam = (k: string, v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        return next;
      },
      { replace: true },
    );

  useDocumentMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/centros',
    noindex: params.size > 0,
  });

  const centers = data ?? [];
  const visible = filterCenters(centers, filters);
  const campuses = campusesOf(centers);
  const odsInUse = ODS.filter((o) => centers.some((c) => c.ods.includes(o.id)));

  const downloadCsv = () => {
    const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'code',
      'acronym',
      'name',
      'city',
      'dane',
      'created',
      'director',
      'lines',
      'ods',
    ] as const;
    const rows = visible.map((c) => [
      c.code,
      c.acronym,
      c.name,
      c.city ? displayName(c.city) : null,
      c.daneCode,
      c.createdAt ? labels.date(c.createdAt) : null,
      c.director ? displayName(c.director.name) : null,
      c.linesCount,
      c.ods.join(', '),
    ]);
    // ";" y BOM: así lo abre bien Excel con la configuración regional de Colombia.
    const csv =
      '﻿' +
      [header.map((h) => cell(t(`csv.${h}`))), ...rows.map((r) => r.map(cell))]
        .map((r) => r.join(';'))
        .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    Object.assign(document.createElement('a'), { href: url, download: t('csv.file') }).click();
    URL.revokeObjectURL(url);
  };

  const jsonLd = data && {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('metaTitle'),
    url: absoluteUrl('/centros'),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: centers.length,
      itemListElement: centers.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'ResearchOrganization',
          name: c.name,
          ...(c.acronym ? { alternateName: c.acronym } : {}),
          identifier: c.code,
          url: absoluteUrl(centerPath(c)),
          parentOrganization: ORGANIZATION,
        },
      })),
    },
  };

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />
      ) : null}

      <section
        aria-labelledby="centers-title"
        className="relative w-full overflow-hidden bg-surface-dark-forest pt-10 pb-16 text-on-primary"
      >
        <HeroWaves />
        <div className="relative container-page flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-label-sm tracking-wide text-primary-fixed">
              <span className="h-2 w-2 rounded-full bg-secondary-fixed" /> {t('common:heroBadge')}
            </p>
            <span className="text-label-sm text-primary-fixed-dim">{t('crumb')}</span>
          </div>
          <div className="flex max-w-3xl flex-col gap-2">
            <h1
              id="centers-title"
              className="text-display-hero-mobile font-bold tracking-tight text-surface-container-lowest md:text-display-hero"
            >
              <Trans t={t} i18nKey="title" components={{ hl: <span className="text-secondary-fixed" /> }} />
            </h1>
            <p className="text-body-lg text-primary-fixed-dim">{t('lead')}</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-primary-container pt-2 sm:grid-cols-4">
            {[
              {
                key: 'active',
                label: t('statActive'),
                value: data && centers.length,
                accent: 'text-surface-container-lowest',
              },
              {
                key: 'campuses',
                label: t('statCampuses'),
                value: data && campuses.length,
                accent: 'text-primary-fixed-dim',
              },
              {
                key: 'lines',
                label: t('statLines'),
                value: data && centers.reduce((n, c) => n + c.linesCount, 0),
                accent: 'text-secondary-fixed',
              },
              {
                key: 'ods',
                label: t('statOds'),
                value: data && odsInUse.length,
                accent: 'text-tertiary-fixed',
              },
            ].map((s) => (
              <div key={s.key} className="flex flex-col-reverse">
                <dt className="text-label-sm text-primary-fixed-dim">{s.label}</dt>
                <dd className={`text-stat-metric font-bold ${s.accent}`}>
                  {s.value === undefined ? '—' : labels.number(s.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="relative z-30 container-page -mt-7">
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col items-stretch gap-4 rounded-2xl bg-surface-container-lowest p-4 shadow-xl lg:flex-row lg:items-center"
        >
          <div className="relative flex flex-1 items-center">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 text-[20px] text-on-surface-variant"
            />
            <label htmlFor="center-search" className="sr-only">
              {t('search')}
            </label>
            <input
              id="center-search"
              type="search"
              value={filters.search}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder={t('searchPlaceholder')}
              autoComplete="off"
              className={`${fieldClass} w-full pr-4 pl-10 text-body-sm`}
            />
          </div>
          <Select
            id="center-campus"
            label={t('filterCampus')}
            value={filters.campus ?? ''}
            onChange={(v) => setParam('sede', v)}
            options={[['', t('allCampuses')], ...campuses]}
          />
          <Select
            id="center-ods"
            label={t('filterOds')}
            value={filters.ods ? String(filters.ods) : ''}
            onChange={(v) => setParam('ods', v)}
            options={[
              ['', t('allOds')],
              ...odsInUse.map(
                (o) =>
                  [
                    String(o.id),
                    `${t('groups:ods.prefix')} ${o.id} · ${t(`groups:ods.names.goal${o.id as OdsId}.short`)}`,
                  ] as [string, string],
              ),
            ]}
          />
        </form>
      </div>

      <section aria-labelledby="centers-list-title" className="w-full py-16">
        <div className="container-page">
          <div className="mb-10 flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <div className="flex flex-col">
              <p className="text-label-md font-bold tracking-widest text-secondary uppercase">
                {t('eyebrow')}
              </p>
              <h2
                id="centers-list-title"
                className="mt-1 text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg"
              >
                {t('listTitle')}
              </h2>
              <p className="mt-1 max-w-2xl text-body-md text-neutral-muted">{t('listLead')}</p>
            </div>
            <p
              aria-live="polite"
              className="inline-flex items-center gap-2 self-start rounded-full bg-badge-sage-bg px-3.5 py-1.5 text-label-md font-semibold text-badge-sage-text md:self-end"
            >
              <Icon name="domain" className="text-[16px]" />
              {data ? t('count', { count: visible.length }) : t('loadingCenters')}
            </p>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!visible.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-lowest px-3 py-1.5 text-label-md font-semibold text-primary ring-1 ring-border-subtle transition-colors hover:bg-surface-cream-alt disabled:opacity-50"
            >
              <Icon name="download" className="text-[18px] text-secondary" /> {t('downloadCsv')}
            </button>
            <div
              role="group"
              aria-label={t('viewLabel')}
              className="inline-flex rounded-lg bg-surface-container-lowest p-1 ring-1 ring-border-subtle"
            >
              {(
                [
                  { id: 'lista', label: t('viewList'), icon: 'view_list' },
                  { id: 'tarjetas', label: t('viewCards'), icon: 'grid_view' },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={view === v.id}
                  onClick={() => setParam('vista', v.id === 'lista' ? '' : v.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label-md font-semibold transition-colors ${
                    view === v.id
                      ? 'bg-primary text-on-primary'
                      : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  <Icon name={v.icon} className="text-[18px]" /> {v.label}
                </button>
              ))}
            </div>
          </div>

          {data ? (
            visible.length ? (
              view === 'lista' ? (
                <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm ring-1 ring-border-subtle">
                  <CenterRowHeader />
                  <ul className="divide-y divide-border-subtle">
                    {visible.map((c) => (
                      <CenterRow key={c.id} center={c} />
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[2200px]:grid-cols-6">
                  {visible.map((c) => (
                    <CenterCard key={c.id} center={c} />
                  ))}
                </div>
              )
            ) : (
              <EmptyState
                title={t('emptyTitle')}
                action={
                  <button
                    type="button"
                    onClick={() =>
                      setParams(view === 'tarjetas' ? { vista: 'tarjetas' } : {}, { replace: true })
                    }
                    className={feedbackButtonClass}
                  >
                    {t('common:feedback.resetFilters')}
                  </button>
                }
              >
                {t('emptyBody')}
              </EmptyState>
            )
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : (
            <div
              aria-busy="true"
              aria-label={t('loading')}
              className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="h-[440px] animate-pulse rounded-[24px] bg-surface-container-lowest motion-reduce:animate-none"
                />
              ))}
            </div>
          )}
        </div>
      </section>
      <ContactCta />
    </>
  );
}

/** Desplegable del buscador flotante, con el mismo estilo que el filtro de categoría de grupos. */
function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="relative w-full lg:w-52">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} w-full cursor-pointer appearance-none px-3 pr-8 text-label-md font-semibold`}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        className="pointer-events-none absolute top-3 right-2.5 text-[18px] text-on-surface-variant"
      />
    </div>
  );
}
