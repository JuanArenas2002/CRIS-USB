import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';
import { scopusProductType, type Product } from '@/domain/authors/author';
import {
  FIRST_RELATIONS_YEAR,
  HEAT_BINS,
  type CountryCollaboration,
  type CountryPublication,
} from '@/domain/relations/relations';
import { ProductRows } from '@/presentation/components/authors/ProductsTable';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { HeroWaves } from '@/presentation/components/layout/HeroWaves';
import { Flag, countryName } from '@/presentation/components/relations/Flag';
import { HEAT_COLORS, NO_DATA } from '@/presentation/components/relations/heat-colors';
import { FilterSelect } from '@/presentation/components/ui/FilterSelect';
import { Icon } from '@/presentation/components/ui/Icon';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { useCollaborationMap, useCountryPublications } from '@/presentation/hooks/use-relations';
import { activeLocale } from '@/i18n';

// El mapa (d3-geo + geometría mundial, ~130 KB) solo se descarga en esta página.
const WorldHeatmap = lazy(() => import('@/presentation/components/relations/WorldHeatmap'));

const TOP = 10;
const PAGE = 25;
const card = 'rounded-2xl bg-surface-container-lowest shadow-sm ring-1 ring-border-subtle';

/** Relacionamiento: mapa de calor de publicaciones en coautoría por país y año. */
export function RelationsPage() {
  const { t } = useTranslation(['relations', 'common']);
  const { number } = useLabels();
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('anio'));
  const thisYear = new Date().getFullYear();
  const year = Number.isInteger(raw) && raw >= FIRST_RELATIONS_YEAR && raw <= thisYear ? raw : null;
  const selected = params.get('pais');
  const { data, isError, error, refetch, isPlaceholderData } = useCollaborationMap(year);

  useDocumentMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/relacionamiento',
    noindex: params.size > 0,
  });

  const setParam = (k: string, v: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set(k, v);
        else next.delete(k);
        return next;
      },
      { replace: true },
    );

  const locale = activeLocale();
  const nameOf = (c: CountryCollaboration) => countryName(c.iso2, c.country, locale);
  const years = Array.from({ length: thisYear - FIRST_RELATIONS_YEAR + 1 }, (_, i) => thisYear - i);
  const countries = data?.countries ?? [];
  const current = countries.find((c) => c.iso3 === selected) ?? null;
  // Rangos de la leyenda a partir de los cortes: 1, 2–5, 6–20, 21–100, 101+.
  const ranges = HEAT_BINS.map((min, i) => {
    const next = HEAT_BINS[i + 1];
    return next ? (next - 1 === min ? `${min}` : `${min}–${next - 1}`) : `${min}+`;
  });

  return (
    <>
      <section
        aria-labelledby="relations-title"
        className="relative w-full overflow-hidden bg-surface-dark-forest pt-10 pb-16 text-on-primary"
      >
        <HeroWaves />
        <div className="relative container-page flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-label-sm tracking-wide text-primary-fixed">
              <span className="h-2 w-2 rounded-full bg-secondary-fixed" /> {t('common:heroBadge')}
            </p>
            <span className="text-label-sm text-primary-fixed-dim">{t('crumb')}</span>
          </div>
          <h1
            id="relations-title"
            className="text-display-hero-mobile font-bold tracking-tight text-surface-container-lowest md:text-display-hero"
          >
            <Trans t={t} i18nKey="title" components={{ hl: <span className="text-secondary-fixed" /> }} />
          </h1>
          <p className="max-w-3xl text-body-lg text-primary-fixed-dim">{t('lead')}</p>
        </div>
      </section>

      <div className="relative z-10 container-page -mt-8 flex flex-col gap-6 pb-16">
        <section aria-labelledby="map-title" className={`${card} flex flex-col gap-5 p-5 md:p-6`}>
          {/* Filtro en una sola fila arriba del mapa. */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 id="map-title" className="text-headline-md font-semibold text-primary">
                {t('mapTitle')}
              </h2>
              <p aria-live="polite" className="text-body-sm text-neutral-muted">
                {data ? t('countries', { count: countries.length }) : t('loading')} · {t('selectHint')}
              </p>
            </div>
            <FilterSelect
              label={t('year')}
              value={year ? String(year) : ''}
              onChange={(v) => setParam('anio', v)}
              options={[['', t('allYears')], ...years.map((y): [string, string] => [String(y), String(y)])]}
              className="sm:w-48"
            />
          </div>

          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div
                className={`flex flex-col gap-4 transition-opacity ${isPlaceholderData ? 'opacity-50' : ''}`}
                aria-busy={!data || isPlaceholderData}
              >
                <Suspense fallback={<MapSkeleton label={t('loading')} />}>
                  {data ? (
                    <WorldHeatmap
                      countries={countries}
                      selected={selected}
                      onSelect={(iso3) => setParam('pais', iso3 === selected ? null : iso3)}
                      onClear={() => setParam('pais', null)}
                      nameOf={nameOf}
                    />
                  ) : (
                    <MapSkeleton label={t('loading')} />
                  )}
                </Suspense>
                {/* Leyenda: barra continua de los 5 tramos (un tono, claro → oscuro) + «sin publicaciones». */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1.5 text-label-sm font-semibold text-on-surface">{t('legend')}</p>
                      <div aria-hidden="true" className="flex h-2.5 overflow-hidden rounded-full">
                        {HEAT_COLORS.map((c) => (
                          <span key={c} className="flex-1" style={{ background: c }} />
                        ))}
                      </div>
                      <ul
                        aria-label={t('legend')}
                        className="mt-1 flex text-[11px] text-neutral-muted tabular-nums"
                      >
                        {ranges.map((r) => (
                          <li key={r} className="flex-1">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="flex items-center gap-1.5 pb-4 text-[11px] text-neutral-muted">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-5 rounded-full ring-1 ring-border-subtle"
                        style={{ background: NO_DATA }}
                      />
                      {t('noData')}
                    </p>
                  </div>
                  <p className="text-label-sm text-neutral-muted">{t('localNote')}</p>
                </div>
              </div>

              {/* Lista: los mismos datos del mapa, sin depender del color y navegable con teclado. */}
              <div>
                <h3 className="mb-3 text-label-md font-bold tracking-wider text-neutral-muted uppercase">
                  {t('topTitle')}
                </h3>
                {data && !countries.length ? (
                  <p className="text-body-sm text-neutral-muted">{t('empty')}</p>
                ) : (
                  <ol className="flex flex-col gap-0.5">
                    {countries.slice(0, TOP).map((c, i) => (
                      <li key={c.iso3}>
                        <button
                          type="button"
                          aria-pressed={c.iso3 === selected}
                          onClick={() => setParam('pais', c.iso3 === selected ? null : c.iso3)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-body-sm transition-colors ${
                            c.iso3 === selected ? 'bg-badge-sage-bg' : 'hover:bg-surface-cream-alt'
                          }`}
                        >
                          <span className="w-5 text-right text-label-sm font-semibold text-neutral-muted">
                            {i + 1}
                          </span>
                          <Flag iso2={c.iso2} />
                          <span className="min-w-0 flex-1 truncate font-medium text-on-surface">
                            {nameOf(c)}
                          </span>
                          <span className="font-semibold text-primary tabular-nums">
                            {number(c.publications)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </section>

        {current ? (
          <CountryPublications
            key={`${current.iso3}-${year ?? ''}`}
            country={current}
            name={nameOf(current)}
            year={year}
            onClose={() => setParam('pais', null)}
          />
        ) : null}
      </div>
      <ContactCta />
    </>
  );
}

/** Publicación con un país → fila de la tabla de productos del portal (mismo estándar visual). */
function useAsProduct() {
  const { t } = useTranslation(['relations', 'publications']);
  return (p: CountryPublication): Product => ({
    key: p.eid,
    typology: 'GNC',
    type: scopusProductType(p.docType),
    title: p.title,
    authors: null,
    year: p.year,
    venue: p.journal,
    index: [
      p.quartile,
      t('publications:item.citations', { count: p.citations }),
      p.partners.length
        ? t('relations:partners', { list: p.partners.slice(0, 2).join(', '), count: p.partners.length })
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
    doi: p.doi,
    url: p.doi
      ? `https://doi.org/${p.doi}`
      : `https://www.scopus.com/record/display.uri?eid=${p.eid}&origin=resultslist`,
  });
}

function CountryPublications({
  country,
  name,
  year,
  onClose,
}: {
  country: CountryCollaboration;
  name: string;
  year: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('relations');
  const { number } = useLabels();
  const asProduct = useAsProduct();
  const { data, isError, error, refetch } = useCountryPublications(country.iso3, year);
  const [limit, setLimit] = useState(PAGE);

  return (
    <section aria-labelledby="country-title" className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Flag iso2={country.iso2} className="h-8 w-12" />
          <div>
            <h2 id="country-title" className="text-headline-md font-semibold text-primary">
              {name}
            </h2>
            <p className="text-body-sm text-neutral-muted">
              {t('publications', { count: country.publications, value: number(country.publications) })}
              {year ? ` · ${year}` : ` · ${t('allYears')}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-cream-alt"
        >
          <Icon name="close" className="text-[20px]" />
        </button>
      </div>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data ? (
        <div
          aria-busy="true"
          aria-label={t('loadingPublications')}
          className="h-64 animate-pulse rounded-xl bg-surface-cream-alt motion-reduce:animate-none"
        />
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-border-subtle">
          <ProductRows products={data.slice(0, limit).map(asProduct)} />
          {data.length > limit ? (
            <div className="border-t border-surface-cream-alt p-3 text-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-label-md font-semibold text-secondary hover:bg-surface-cream-alt"
              >
                {t('more', { count: Math.min(PAGE, data.length - limit) })}
                <Icon name="expand_more" className="text-[18px]" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function MapSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="aspect-[960/470] w-full animate-pulse rounded-xl bg-surface-cream-alt motion-reduce:animate-none"
    />
  );
}
