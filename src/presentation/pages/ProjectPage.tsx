import { withBaseUrl } from '@/shared/base';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { authorSlug, displayName, parseAuthorId, slugify } from '@/domain/authors/author';
import { projectProducts, projectSlug, timeProgress, type Project } from '@/domain/projects/project';
import { EMPTY_FILTERS, ProductsTable } from '@/presentation/components/authors/ProductsTable';
import { centerPath } from '@/presentation/components/centers/CenterCard';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { OdsIcon } from '@/presentation/components/groups/OdsIcons';
import { Carousel } from '@/presentation/components/ui/Carousel';
import { Icon } from '@/presentation/components/ui/Icon';
import { AutoTranslateNote, TextSkeleton, sourceLang } from '@/presentation/components/ui/AutoTranslate';
import { useAutoTranslate } from '@/presentation/hooks/use-auto-translate';
import { useCenters } from '@/presentation/hooks/use-centers';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useGroups } from '@/presentation/hooks/use-groups';
import { useProjectQueries } from '@/presentation/hooks/use-projects';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';
import { ProjectStatus, projectPath } from './ProjectsPage';

const card = 'rounded-2xl border border-border-subtle/70 bg-surface-container-lowest shadow-sm';

export function ProjectPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const id = parseAuthorId(slug);
  const q = useProjectQueries();
  const { data, isError, error, refetch } = useQuery({ ...q.detail(id ?? 0), enabled: id !== null });
  const { t } = useTranslation('projects');

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = projectSlug(data.project);
    if (slug !== canonical) return <Navigate replace to={`/proyectos/${canonical}${search}`} />;
    return <ProjectProfile project={data.project} />;
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

function SectionTitle({ children, lead, aside }: { children: ReactNode; lead?: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-2 border-b border-border-subtle/80 pb-2 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span className="h-6 w-1.5 shrink-0 rounded-full bg-secondary" />
        <div>
          <h2 className="text-headline-md font-semibold text-primary">{children}</h2>
          {lead ? <p className="text-body-sm text-on-surface-variant">{lead}</p> : null}
        </div>
      </div>
      {aside}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  children,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`${card} flex flex-col justify-between p-5`}>
      <div className="flex flex-col gap-1.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-badge-sage-bg bg-badge-sage-bg text-badge-sage-text">
          <Icon name={icon} className="text-[24px]" />
        </span>
        <span className="pt-1 text-label-sm tracking-wider text-neutral-muted uppercase">{label}</span>
        <p className="text-headline-sm font-semibold text-primary">{value}</p>
      </div>
      {children ? (
        <div className="mt-4 border-t border-surface-cream-alt pt-3 text-label-sm">{children}</div>
      ) : null}
    </div>
  );
}

/** Texto libre de Metri-K con las URLs convertidas en enlaces. */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s|]+)/).map((part, i) =>
        i % 2 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener"
            className="break-all text-secondary underline hover:text-primary"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

const norm = (s: string) => slugify(s);

function ProjectProfile({ project: p }: { project: Project }) {
  const { t } = useTranslation(['projects', 'common', 'groups']);
  const path = projectPath(p);
  const progress = timeProgress(p);
  const period = p.startYear
    ? `${p.startYear}${p.endYear && p.endYear !== p.startYear ? ` – ${p.endYear}` : ''}`
    : '—';

  // Textos libres de Metri-K (vacíos si no hay: el hook los deja igual).
  const prose = [p.objective, p.problem, p.solution, p.beneficiaries, p.results].map((s) => s ?? '');
  const tr = useAutoTranslate(prose);
  const proseOf = (i: number) =>
    tr.status === 'pending' ? (
      <TextSkeleton lines={3} />
    ) : (
      <span lang={sourceLang(tr.status)}>{tr.texts[i]}</span>
    );

  // Metri-K da los grupos y centros por nombre: se enlazan a su ficha si coinciden.
  const groups = useGroups().data ?? [];
  const centers = useCenters().data ?? [];
  const groupOf = (name: string) => groups.find((g) => norm(g.name) === norm(name));
  const centerOf = (name: string) => centers.find((c) => norm(c.name) === norm(name));

  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useDocumentMetadata({
    title: p.title,
    description: `${t('detail.metaBase')}${p.objective ? `: ${p.objective}` : ''}`.slice(0, 300),
    path,
  });

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ResearchProject',
      name: p.title,
      identifier: p.code,
      url: absoluteUrl(path),
      parentOrganization: ORGANIZATION,
      ...(p.objective ? { description: p.objective } : {}),
      ...(p.funder ? { funder: { '@type': 'Organization', name: p.funder } } : {}),
      ...(p.area ? { knowsAbout: p.area } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('metaTitle'), item: absoluteUrl('/proyectos') },
        { '@type': 'ListItem', position: 2, name: p.title, item: absoluteUrl(path) },
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
              <Link to="/proyectos" className="hover:text-primary">
                {t('common:nav.items.projects.label')}
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" className="text-[16px]" />
            </li>
            <li aria-current="page" className="font-mono font-semibold text-on-surface">
              {p.code}
            </li>
          </ol>
        </nav>
      </div>

      {/* Encabezado */}
      <section className="bg-surface-container-lowest py-8 shadow-sm">
        <div className="container-page flex flex-col gap-6 lg:flex-row lg:items-center">
          {p.photoUrl ? (
            <img
              src={withBaseUrl(p.photoUrl)}
              alt={t('detail.photoAlt', { title: p.title })}
              className="aspect-video w-full shrink-0 rounded-2xl object-cover shadow-sm lg:w-[28rem]"
            />
          ) : null}
          <div className="flex max-w-5xl flex-col gap-3">
            <h1 className="text-headline-lg-mobile leading-snug font-bold tracking-tight text-primary md:text-headline-lg">
              {p.title}
            </h1>
            {/* Encabezado limpio: el código ya va en la ruta y los centros en «Equipo, grupos y centros». */}
            <p className="flex flex-wrap items-center gap-3 text-body-sm text-on-surface-variant">
              {p.territory ? (
                <span className="flex items-center gap-1.5">
                  <Icon name="location_on" className="text-[16px] text-secondary" /> {p.territory}
                </span>
              ) : null}
              <ProjectStatus status={p.status} />
            </p>
          </div>
        </div>
      </section>

      <div className="container-page mt-8 flex flex-col gap-12">
        {/* Información institucional */}
        <section>
          <SectionTitle>{t('detail.institutional')}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <InfoCard icon="menu_book" label={t('detail.area')} value={p.area ?? '—'} />
            <InfoCard icon="calendar_today" label={t('detail.period')} value={period}>
              {progress !== null ? (
                <>
                  <div className="mb-1.5 flex justify-between text-on-surface-variant">
                    <span>{t('detail.progress')}</span>
                    <span className="font-semibold text-secondary">{progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={t('detail.progress')}
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-cream-alt"
                  >
                    <div className="h-full rounded-full bg-secondary" style={{ width: `${progress}%` }} />
                  </div>
                </>
              ) : null}
            </InfoCard>
            <InfoCard icon="account_balance" label={t('detail.funder')} value={p.funder ?? '—'}>
              {p.resources ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-neutral-muted">{t('detail.resources')}</span>
                  <span className="rounded-full bg-badge-sage-bg px-2.5 py-0.5 font-semibold text-badge-sage-text">
                    {p.resources}
                  </span>
                </div>
              ) : null}
            </InfoCard>
          </div>
        </section>

        {/* Marco y objetivos, con los ODS en una columna a la derecha */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className={`${card} flex flex-col gap-5 p-5 md:p-8`}>
            <SectionTitle>{t('detail.framework')}</SectionTitle>
            {prose.some(Boolean) ? <AutoTranslateNote status={tr.status} onRetry={tr.retry} /> : null}
            {p.objective ? (
              <div className="rounded-xl border-l-4 border-secondary bg-badge-sage-bg/60 p-5 md:p-6">
                <h3 className="mb-1 flex items-center gap-2 text-label-md font-bold tracking-widest text-badge-sage-text uppercase">
                  <Icon name="format_quote" className="text-[24px]" /> {t('detail.objective')}
                </h3>
                <p className="text-body-lg leading-relaxed text-on-surface">{proseOf(0)}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(
                [
                  [1, 'problem', 'flag'],
                  [2, 'solution', 'lightbulb'],
                  [3, 'beneficiaries', 'groups'],
                ] as const
              ).map(([i, key, icon]) =>
                prose[i] ? (
                  <div key={key} className="rounded-xl bg-canvas-cream p-4">
                    <h3 className="mb-1.5 flex items-center gap-2 text-label-md font-bold tracking-wider text-secondary uppercase">
                      <Icon name={icon} className="text-[18px]" /> {t(`detail.${key}`)}
                    </h3>
                    <p className="text-body-sm whitespace-pre-line text-on-surface-variant">{proseOf(i)}</p>
                  </div>
                ) : null,
              )}
            </div>
            {p.results ? (
              <div>
                <h3 className="mb-1.5 flex items-center gap-2 text-label-md font-bold tracking-wider text-secondary uppercase">
                  <Icon name="emoji_events" className="text-[18px]" /> {t('detail.results')}
                </h3>
                <p className="text-body-sm whitespace-pre-line text-on-surface-variant">{proseOf(4)}</p>
              </div>
            ) : null}
            {p.evidence ? (
              <div>
                <h3 className="mb-1.5 flex items-center gap-2 text-label-md font-bold tracking-wider text-secondary uppercase">
                  <Icon name="verified" className="text-[18px]" /> {t('detail.evidence')}
                </h3>
                <p className="text-body-sm whitespace-pre-line text-on-surface-variant">
                  <Linkified text={p.evidence} />
                </p>
              </div>
            ) : null}
          </section>

          <aside className={`${card} flex flex-col gap-4 p-5 lg:sticky lg:top-24`}>
            <div>
              <h2 className="text-headline-sm font-semibold text-primary">{t('detail.ods')}</h2>
              <p className="text-body-sm text-on-surface-variant">{t('detail.odsLead')}</p>
            </div>
            {p.ods.length ? (
              <ul className="flex flex-col gap-3">
                {p.ods.map((id) => (
                  <li key={id} className="flex items-center gap-3">
                    <OdsIcon id={id} size={48} />
                    <span className="text-body-sm leading-tight font-semibold text-primary">
                      {t(`groups:ods.names.goal${id}.name`)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-neutral-muted">{t('detail.noOds')}</p>
            )}
          </aside>
        </div>

        {/* Fotos asociadas (/admin/proyectos/fotos) */}
        {p.gallery.length ? (
          <section>
            <SectionTitle>{t('detail.gallery')}</SectionTitle>
            <Carousel
              label={t('detail.gallery')}
              images={p.gallery.map((g, i) => ({
                src: withBaseUrl(g.url),
                alt: t('detail.galleryAlt', { n: i + 1, title: p.title }),
              }))}
            />
          </section>
        ) : null}

        {/* Equipo, grupos y centros */}
        <section>
          <SectionTitle>{t('detail.team')}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-headline-sm font-semibold text-primary">{t('detail.groups')}</h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {p.groups.map((name) => {
                  const g = groupOf(name);
                  return (
                    <li key={name} className={`${card} flex flex-col justify-between gap-3 p-4`}>
                      <p className="flex items-start gap-2 font-semibold text-primary">
                        <Icon name="hub" className="mt-0.5 text-[18px] text-secondary" /> {name}
                      </p>
                      {g ? (
                        <Link
                          to={`/grupos/${authorSlug(g)}`}
                          className="inline-flex items-center gap-1 border-t border-surface-cream-alt pt-2 text-label-md font-semibold text-secondary hover:underline"
                        >
                          {t('detail.viewGroup')} <Icon name="arrow_forward" className="text-[16px]" />
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-headline-sm font-semibold text-primary">{t('detail.centers')}</h3>
              <ul className="grid grid-cols-1 gap-3">
                {p.centers.map((name) => {
                  const c = centerOf(name);
                  return (
                    <li key={name} className={`${card} flex flex-col justify-between gap-3 p-4`}>
                      <p className="flex items-start gap-2 font-semibold text-primary">
                        <Icon name="domain" className="mt-0.5 text-[18px] text-secondary" /> {name}
                      </p>
                      {c ? (
                        <Link
                          to={centerPath(c)}
                          className="inline-flex items-center gap-1 border-t border-surface-cream-alt pt-2 text-label-md font-semibold text-secondary hover:underline"
                        >
                          {t('detail.viewCenter')} <Icon name="arrow_forward" className="text-[16px]" />
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {p.team.length || p.allies ? (
                <dl className={`${card} flex flex-col gap-3 p-4 text-body-sm`}>
                  {p.team.length ? (
                    <div>
                      <dt className="text-label-sm tracking-wider text-neutral-muted uppercase">
                        {t('detail.leaders')}
                      </dt>
                      <dd>
                        <ul className="mt-1 flex flex-col gap-1.5">
                          {p.team.map((m) => (
                            <li key={m.name} className="flex items-start gap-2">
                              <Icon name="person" className="mt-0.5 text-[16px] text-secondary" />
                              <span>
                                <span className="font-semibold text-on-surface">{displayName(m.name)}</span>
                                {m.role ? (
                                  <span className="block text-label-sm text-neutral-muted">{m.role}</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                  {p.allies ? (
                    <div>
                      <dt className="flex items-center gap-1 text-label-sm tracking-wider text-neutral-muted uppercase">
                        <Icon name="handshake" className="text-[16px]" /> {t('detail.allies')}
                      </dt>
                      <dd className="font-semibold text-on-surface">{p.allies}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
          </div>
        </section>

        {/* Productos: misma tabla que en el perfil del investigador */}
        <section>
          <SectionTitle lead={t('detail.productsLead', { count: p.products.length, code: p.code })}>
            {t('detail.products')}
          </SectionTitle>
          {p.products.length ? (
            <ProductsTable products={projectProducts(p)} filters={filters} onFiltersChange={setFilters} />
          ) : (
            <p className="text-body-sm text-neutral-muted">{t('detail.noProducts')}</p>
          )}
        </section>

        <Link
          to="/proyectos"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('detail.back')}
        </Link>
      </div>
    </article>
  );
}
