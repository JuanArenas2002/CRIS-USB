import { Link, Navigate, useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authorSlug, displayName, externalProfiles, parseAuthorId } from '@/domain/authors/author';
import { resolutionFileUrl, type CenterDetail } from '@/domain/centers/center';
import { CenterStatus } from '@/presentation/components/centers/CenterCard';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { OdsLinked } from '@/presentation/components/groups/OdsIcons';
import { Icon } from '@/presentation/components/ui/Icon';
import { IdLogo } from '@/presentation/components/ui/IdLogo';
import { Field, InfoColumn, SectionHead } from '@/presentation/components/ui/InfoBlocks';
import { useCenterQueries } from '@/presentation/hooks/use-centers';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';

const card = 'rounded-xl bg-surface-container-lowest shadow-sm';

export function CenterPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const id = parseAuthorId(slug);
  const q = useCenterQueries();
  const { data, isError, error, refetch } = useQuery({ ...q.detail(id ?? 0), enabled: id !== null });
  const { t } = useTranslation('centers');

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = authorSlug(data.center);
    if (slug !== canonical) return <Navigate replace to={`/centros/${canonical}${search}`} />;
    return <CenterProfile center={data.center} />;
  }
  return (
    <div className="container-page py-16">
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div
          aria-busy="true"
          aria-label={t('detail.loading')}
          className="h-64 animate-pulse rounded-3xl bg-surface-container-lowest"
        />
      )}
    </div>
  );
}

function CenterProfile({ center: c }: { center: CenterDetail }) {
  const { t } = useTranslation(['centers', 'common']);
  const labels = useLabels();
  const path = `/centros/${authorSlug(c)}`;
  const city = c.city ? displayName(c.city) : null;
  const director = c.director;
  const profiles = director ? externalProfiles(director) : [];
  const years = c.foundedYear ? new Date().getFullYear() - c.foundedYear : null;
  const lineNames = c.lines.map((l) => l.name);

  useDocumentMetadata({
    title: c.acronym ? `${c.acronym} · ${c.name}` : c.name,
    description: `${t('detail.metaBase', { name: c.name })}${
      lineNames.length ? t('detail.metaLines', { lines: lineNames.slice(0, 3).join(', ') }) : ''
    }.`,
    path,
  });

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ResearchOrganization',
      name: c.name,
      ...(c.acronym ? { alternateName: c.acronym } : {}),
      identifier: c.code,
      url: absoluteUrl(path),
      parentOrganization: ORGANIZATION,
      ...(c.createdAt ? { foundingDate: c.createdAt } : {}),
      ...(city ? { location: { '@type': 'Place', name: city } } : {}),
      ...(lineNames.length ? { knowsAbout: lineNames } : {}),
      ...(director
        ? {
            employee: {
              '@type': 'Person',
              name: displayName(director.name),
              jobTitle: t('detail.directorName'),
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('metaTitle'), item: absoluteUrl('/centros') },
        { '@type': 'ListItem', position: 2, name: c.name, item: absoluteUrl(path) },
      ],
    },
  ];

  return (
    <article className="pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(jsonLd) }} />

      <div className="border-b border-border-subtle bg-surface-container-lowest">
        <nav aria-label={t('common:breadcrumb.label')} className="container-page py-3">
          <ol className="flex flex-wrap items-center gap-1 text-label-md text-neutral-muted">
            <li>
              <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
                <Icon name="home" className="text-[16px]" /> {t('common:breadcrumb.home')}
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" className="text-[16px]" />
            </li>
            <li>
              <Link to="/centros" className="hover:text-primary">
                {t('common:nav.items.centers.label')}
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" className="text-[16px]" />
            </li>
            <li aria-current="page" className="font-semibold text-on-surface">
              {c.acronym ?? c.code}
            </li>
          </ol>
        </nav>
      </div>

      <div className="container-page mt-gutter flex flex-col gap-5">
        {/* Encabezado */}
        <section className={`${card} relative overflow-hidden p-5 md:p-6`}>
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-surface-cream-alt/40" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-on-primary shadow-inner md:h-16 md:w-16 ${
                c.active ? 'bg-primary-container' : 'bg-neutral-muted'
              }`}
            >
              <Icon name="domain" className="text-[32px] md:text-[36px]" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-primary-container px-2 py-0.5 text-label-sm font-bold text-on-primary">
                  {c.code}
                </span>
                {c.acronym ? (
                  <span className="text-headline-sm font-bold text-secondary">{c.acronym}</span>
                ) : null}
                <CenterStatus active={c.active} />
              </p>
              <h1 className="text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
                {c.name}
              </h1>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
                {director ? (
                  <span className="flex items-center gap-1.5 font-medium text-primary">
                    <Icon name="verified_user" className="text-[16px] text-secondary" />
                    {t('detail.director', { name: displayName(director.name) })}
                  </span>
                ) : null}
                {director ? <span className="text-neutral-muted">·</span> : null}
                <span>Universidad Simón Bolívar{city ? ` (${city})` : ''}</span>
              </p>
              {!c.active ? (
                <p className="text-body-sm text-neutral-muted">{t('detail.inactiveNote')}</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Información institucional */}
        <section className={`${card} p-5 md:p-6`}>
          <SectionHead icon="corporate_fare">{t('detail.institutional')}</SectionHead>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            <InfoColumn icon="badge" title={t('detail.identification')}>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('detail.code')}>
                  <span className="font-mono text-primary">{c.code}</span>
                </Field>
                <Field label={t('detail.acronym')}>{c.acronym ?? '—'}</Field>
              </div>
              <Field label={t('detail.createdAt')}>
                {c.createdAt
                  ? years
                    ? t('detail.age', { date: labels.date(c.createdAt), count: years })
                    : labels.date(c.createdAt)
                  : '—'}
              </Field>
              <Field label={t('detail.status')}>
                <CenterStatus active={c.active} />
              </Field>
            </InfoColumn>
            <InfoColumn icon="location_on" title={t('detail.location')}>
              <Field label={t('detail.campus')}>{city ?? '—'}</Field>
              <Field label={t('detail.department')}>{c.department ? displayName(c.department) : '—'}</Field>
              <Field label={t('detail.dane')}>
                <span className="font-mono">{c.daneCode ?? '—'}</span>
              </Field>
            </InfoColumn>
            <InfoColumn icon="verified_user" title={t('detail.directorTitle')}>
              {director ? (
                <>
                  <Field label={t('detail.directorName')}>{displayName(director.name)}</Field>
                  {profiles.length ? (
                    <Field label={t('detail.profiles')}>
                      <ul className="mt-1 flex flex-wrap gap-2">
                        {profiles.map((p) => (
                          <li key={p.label}>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener"
                              title={`${p.label}: ${labels.domain(p.value)}`}
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-container-lowest transition-colors hover:border-primary-container focus-visible:outline-2 focus-visible:outline-primary-container"
                            >
                              <IdLogo label={p.label} size={24} />
                              <span className="sr-only">
                                {`${p.label}: ${labels.domain(p.value)} ${t('common:newTab')}`}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </Field>
                  ) : null}
                </>
              ) : (
                <p className="text-body-sm text-neutral-muted">{t('detail.noDirector')}</p>
              )}
            </InfoColumn>
          </div>
        </section>

        {/* Líneas + ODS */}
        <section
          className={`${card} flex flex-col items-stretch gap-6 p-5 md:p-6 lg:flex-row`}
          aria-label={t('detail.linesAndOds')}
        >
          <div className="flex-1 border-border-subtle/60 pb-6 max-lg:border-b lg:border-r lg:pr-6 lg:pb-0">
            <h2 className="mb-3.5 flex items-center gap-2 text-headline-sm font-bold tracking-tight text-primary">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-secondary">
                <Icon name="checklist_rtl" className="text-[20px]" />
              </span>
              {t('detail.lines')}
            </h2>
            {c.lines.length ? (
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {c.lines.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border-subtle/80 bg-canvas-cream p-3"
                  >
                    <Icon name="check_circle" className="text-[18px] text-secondary" />
                    <span className="text-body-sm leading-tight font-medium text-on-surface">{l.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-neutral-muted">{t('detail.noLines')}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col lg:w-[22rem] xl:w-[26rem]">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-headline-sm font-bold tracking-tight text-primary">
                <Icon name="public" className="text-[24px] text-secondary" /> {t('detail.ods')}
              </h2>
              <span className="rounded-full bg-surface-cream-alt px-3 py-1 text-[12px] font-medium text-on-surface-variant">
                {t('detail.agenda')}
              </span>
            </div>
            <OdsLinked ods={c.ods} empty={t('detail.noOds')} />
          </div>
        </section>

        {/* Resoluciones */}
        <section className={`${card} p-5 md:p-6`}>
          <SectionHead icon="gavel">{t('detail.resolutions')}</SectionHead>
          <p className="-mt-2 mb-4 text-body-sm text-on-surface-variant">{t('detail.resolutionsLead')}</p>
          {c.resolutions.length ? (
            <ul className="flex flex-col gap-3">
              {c.resolutions.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col items-start justify-between gap-4 rounded-xl bg-canvas-cream p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-secondary">
                      <Icon name="description" className="text-[18px]" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="flex flex-wrap items-center gap-2">
                        {r.type ? (
                          <span className="rounded-full bg-badge-sage-bg px-2 py-0.5 text-label-sm font-bold text-badge-sage-text">
                            {labels.domain(r.type)}
                          </span>
                        ) : null}
                        {r.date ? (
                          <span className="text-[12px] text-neutral-muted">{labels.date(r.date)}</span>
                        ) : null}
                      </p>
                      <h3 className="text-headline-sm font-semibold text-primary">{r.number ?? '—'}</h3>
                      {r.description ? (
                        <p className="text-body-sm text-on-surface-variant">{r.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {r.hasFile ? (
                    <a
                      href={resolutionFileUrl(c.id, r.id)}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-secondary"
                    >
                      <Icon name="picture_as_pdf" className="text-[18px]" /> {t('detail.viewPdf')}
                      <span className="sr-only">{t('common:newTab')}</span>
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-neutral-muted">{t('detail.noResolutions')}</p>
          )}
        </section>

        <Link
          to="/centros"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('detail.back')}
        </Link>
      </div>
    </article>
  );
}
