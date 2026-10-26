import { withBaseUrl } from '@/shared/base';
import { Link, useSearchParams } from 'react-router';
import { Trans, useTranslation } from 'react-i18next';
import {
  filterProjects,
  isRunning,
  projectSlug,
  type Project,
  type ProjectFilters,
} from '@/domain/projects/project';
import { EmptyState, ErrorState, feedbackButtonClass } from '@/presentation/components/feedback/Feedback';
import { ContactCta } from '@/presentation/components/layout/ContactCta';
import { HeroWaves } from '@/presentation/components/layout/HeroWaves';
import { Icon } from '@/presentation/components/ui/Icon';
import { ClearFilters, FilterSelect } from '@/presentation/components/ui/FilterSelect';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { useProjects } from '@/presentation/hooks/use-projects';
import { useCenters } from '@/presentation/hooks/use-centers';
import { slugify } from '@/domain/authors/author';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';

// Mismo estándar visual que CentersPage: héroe oscuro, buscador flotante y lista.
const fieldClass =
  'h-11 rounded-xl bg-canvas-cream text-on-surface transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none';

const distinct = (values: (string | null)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'es'));

export const projectPath = (p: Pick<Project, 'id' | 'title'>) => `/proyectos/${projectSlug(p)}`;

/** Estado del proyecto solo con icono (como CenterStatus): el texto va en tooltip y lector de pantalla. */
export function ProjectStatus({ status }: { status: string | null }) {
  if (!status) return null;
  const running = isRunning({ status });
  return (
    <span className="group/status relative z-10 inline-flex">
      <span
        tabIndex={0}
        className={`flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-secondary ${
          running ? 'bg-badge-sage-bg text-secondary' : 'bg-surface-variant text-on-surface-variant'
        }`}
      >
        <Icon name={running ? 'bolt' : 'check_circle'} className="text-[18px]" />
        <span className="sr-only">{status}</span>
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-md bg-surface-dark-forest px-2.5 py-1 text-label-sm font-semibold whitespace-nowrap text-on-primary opacity-0 shadow-md ring-1 ring-white/20 transition-opacity group-focus-within/status:opacity-100 group-hover/status:opacity-100"
      >
        {status}
      </span>
    </span>
  );
}

const COLS = 'lg:grid-cols-[8rem_minmax(0,1fr)_9rem_4rem_3.5rem_8rem]';

export function ProjectsPage() {
  const { data, isError, error, refetch } = useProjects();
  const { t } = useTranslation(['projects', 'common']);
  const labels = useLabels();
  const [params, setParams] = useSearchParams();
  const filters: ProjectFilters = {
    search: params.get('q') ?? '',
    status: params.get('estado'),
    center: params.get('centro'),
  };

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
  const clearFilters = () => setParams({}, { replace: true });

  useDocumentMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/proyectos',
    noindex: params.size > 0,
  });

  const projects = data ?? [];
  const visible = filterProjects(projects, filters);
  const options = (values: (string | null)[]) => distinct(values).map((v): [string, string] => [v, v]);

  const jsonLd = data && {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('metaTitle'),
    url: absoluteUrl('/proyectos'),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: projects.length,
      itemListElement: projects.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'ResearchProject',
          name: p.title,
          identifier: p.code,
          url: absoluteUrl(projectPath(p)),
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
        aria-labelledby="projects-title"
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
              id="projects-title"
              className="text-display-hero-mobile font-bold tracking-tight text-surface-container-lowest md:text-display-hero"
            >
              <Trans t={t} i18nKey="title" components={{ hl: <span className="text-secondary-fixed" /> }} />
            </h1>
            <p className="text-body-lg text-primary-fixed-dim">{t('lead')}</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-primary-container pt-2 sm:grid-cols-4">
            {[
              {
                key: 'total',
                label: t('statTotal'),
                value: projects.length,
                accent: 'text-surface-container-lowest',
              },
              {
                key: 'running',
                label: t('statRunning'),
                value: projects.filter(isRunning).length,
                accent: 'text-primary-fixed-dim',
              },
              {
                key: 'centers',
                label: t('statCenters'),
                value: distinct(projects.flatMap((p) => p.centers)).length,
                accent: 'text-secondary-fixed',
              },
              {
                key: 'products',
                label: t('statProducts'),
                value: projects.reduce((n, p) => n + p.products.length, 0),
                accent: 'text-tertiary-fixed',
              },
            ].map((s) => (
              <div key={s.key} className="flex flex-col-reverse">
                <dt className="text-label-sm text-primary-fixed-dim">{s.label}</dt>
                <dd className={`text-stat-metric font-bold ${s.accent}`}>
                  {data ? labels.number(s.value) : '—'}
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
            <label htmlFor="project-search" className="sr-only">
              {t('search')}
            </label>
            <input
              id="project-search"
              type="search"
              value={filters.search}
              onChange={(e) => setParam('q', e.target.value)}
              placeholder={t('searchPlaceholder')}
              autoComplete="off"
              className={`${fieldClass} w-full pr-4 pl-10 text-body-sm`}
            />
          </div>
          <FilterSelect
            label={t('filterStatus')}
            value={filters.status ?? ''}
            onChange={(v) => setParam('estado', v)}
            options={[['', t('allStatuses')], ...options(projects.map((p) => p.status))]}
          />
          <FilterSelect
            label={t('filterCenter')}
            value={filters.center ?? ''}
            onChange={(v) => setParam('centro', v)}
            options={[['', t('allCenters')], ...options(projects.flatMap((p) => p.centers))]}
          />
          <ClearFilters
            show={Boolean(filters.search || filters.status || filters.center)}
            label={t('common:feedback.resetFilters')}
            onClick={clearFilters}
          />
        </form>
      </div>

      <section aria-label={t('metaTitle')} className="w-full py-16">
        <div className="container-page">
          <p
            aria-live="polite"
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-badge-sage-bg px-3 py-1 text-label-md font-semibold text-badge-sage-text"
          >
            <Icon name="science" className="text-[16px]" />
            {data ? t('count', { count: visible.length }) : t('loading')}
          </p>

          {data ? (
            visible.length ? (
              <ProjectList projects={visible} />
            ) : (
              <EmptyState
                title={t('emptyTitle')}
                action={
                  <button type="button" onClick={clearFilters} className={feedbackButtonClass}>
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
              className="h-96 animate-pulse rounded-2xl bg-surface-container-lowest motion-reduce:animate-none"
            />
          )}
        </div>
      </section>
      <ContactCta />
    </>
  );
}

/** Lista de proyectos (también en la ficha de cada centro). */
export function ProjectList({ projects }: { projects: Project[] }) {
  const { t } = useTranslation('projects');
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm ring-1 ring-border-subtle">
      <div
        aria-hidden="true"
        className={`hidden gap-4 border-b border-border-subtle px-5 py-3 text-[10px] font-semibold tracking-wider text-neutral-muted uppercase lg:grid ${COLS}`}
      >
        <span>{t('table.photo')}</span>
        <span>{t('table.title')}</span>
        <span>{t('table.center')}</span>
        <span>{t('table.year')}</span>
        <span>{t('table.status')}</span>
        <span />
      </div>
      <ul className="divide-y divide-border-subtle">
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </ul>
    </div>
  );
}

/** Centros del proyecto con su logo (o sigla) del portal; el nombre completo va en el tooltip. */
function ProjectCenters({ names }: { names: string[] }) {
  const centers = useCenters().data ?? [];
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {names.map((name) => {
        const c = centers.find((x) => slugify(x.name) === slugify(name));
        return c?.logoUrl ? (
          <img
            key={name}
            src={withBaseUrl(c.logoUrl)}
            alt={name}
            title={name}
            loading="lazy"
            className="h-8 w-auto max-w-24 rounded-md border border-border-subtle bg-white object-contain p-0.5"
          />
        ) : (
          <span
            key={name}
            title={name}
            className="max-w-full truncate rounded-md bg-surface-cream-alt px-2 py-1 text-label-sm font-semibold text-on-surface-variant"
          >
            {c?.acronym ?? name}
          </span>
        );
      })}
    </span>
  );
}

/** Fila de la lista: foto principal, título, centro, año, estado y «Ver detalle»; toda la fila enlaza. */
function ProjectRow({ project: p }: { project: Project }) {
  const { t } = useTranslation('projects');
  return (
    <li
      className={`group relative grid grid-cols-[6rem_1fr] items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-cream-alt/60 lg:px-5 ${COLS}`}
    >
      <span className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-dark-forest">
        {p.photoUrl ? (
          <img src={withBaseUrl(p.photoUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-secondary-fixed">
            <Icon name="science" className="text-[28px]" />
          </span>
        )}
      </span>

      <div className="min-w-0">
        <h2 className="text-body-md font-semibold text-[#0F241A] group-hover:text-primary">
          <Link
            to={projectPath(p)}
            className="line-clamp-2 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-secondary"
          >
            {p.title}
          </Link>
        </h2>
        {/* En móvil y tableta, los datos de las columnas van en esta línea. */}
        <p className="mt-1 flex items-center gap-2 text-label-sm text-neutral-muted lg:hidden">
          {p.year ?? ''}
          <ProjectCenters names={p.centers} />
          <ProjectStatus status={p.status} />
        </p>
      </div>

      <div className="hidden lg:block">
        <ProjectCenters names={p.centers} />
      </div>
      <p className="hidden text-body-sm font-semibold text-on-surface lg:block">{p.year ?? '—'}</p>
      <p className="hidden lg:block">
        <ProjectStatus status={p.status} />
      </p>
      <span
        aria-hidden="true"
        className="hidden items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-label-md font-semibold text-on-primary transition-colors group-hover:bg-secondary lg:inline-flex"
      >
        {t('table.view')} <Icon name="arrow_forward" className="text-[16px]" />
      </span>
    </li>
  );
}
