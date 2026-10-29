import { withBaseUrl } from '@/shared/base';
import { useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AUTHOR_CATEGORIES,
  authorSlug,
  categoryOf,
  displayName,
  externalProfiles,
  initials,
  mergeProducts,
  parseAuthorId,
  toProducts,
  TYPOLOGIES,
  type Product,
  type TypologyId,
} from '@/domain/authors/author';
import type { GroupDetail, GroupLine, GroupMember } from '@/domain/groups/group';
import { CategoryTimeline } from '@/presentation/components/groups/CategoryTimeline';
import { GroupCenters } from '@/presentation/components/groups/GroupCenters';
import { OdsLinked } from '@/presentation/components/groups/OdsIcons';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { categoryTone } from '@/presentation/components/groups/category-tone';
import { Icon } from '@/presentation/components/ui/Icon';
import { Field, InfoColumn, SectionHead } from '@/presentation/components/ui/InfoBlocks';
import { TabBar } from '@/presentation/components/ui/TabBar';
import { TypologyCard } from '@/presentation/components/ui/TypologyCard';
import {
  EMPTY_FILTERS,
  ProductsTable,
  type ProductFilters,
} from '@/presentation/components/authors/ProductsTable';
import { useAuthorProfiles } from '@/presentation/hooks/use-authors';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
import { useLabels } from '@/presentation/hooks/use-labels';
import { useAutoTranslate } from '@/presentation/hooks/use-auto-translate';
import { AutoTranslateNote, sourceLang } from '@/presentation/components/ui/AutoTranslate';
import { GroupQueriesContext } from '@/presentation/hooks/use-groups';
import { ORGANIZATION, absoluteUrl, safeJson } from '@/shared/seo';
import { NotFoundPage } from './NotFoundPage';

function useGroupQueries() {
  const q = useContext(GroupQueriesContext);
  if (!q) throw new Error('GroupQueriesContext no está provisto');
  return q;
}

export function GroupPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const id = parseAuthorId(slug);
  const q = useGroupQueries();
  const { data, isError, error, refetch } = useQuery({ ...q.detail(id ?? 0), enabled: id !== null });
  const { t } = useTranslation(['groups', 'common', 'authors']);

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = authorSlug(data.group);
    if (slug !== canonical) return <Navigate replace to={`/grupos/${canonical}${search}`} />;
    return <GroupProfile group={data.group} />;
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

type Tab = 'perfil' | 'integrantes' | 'produccion';
const TABS: Tab[] = ['perfil', 'integrantes', 'produccion'];
const card = 'rounded-xl bg-surface-container-lowest shadow-sm';
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const LINE_FIELDS = [
  { key: 'objective', label: 'detail.lineObjective', icon: 'flag' },
  { key: 'achievements', label: 'detail.lineAchievements', icon: 'emoji_events' },
  { key: 'impact', label: 'detail.lineImpact', icon: 'bolt' },
] as const;

function GroupProfile({ group }: { group: GroupDetail }) {
  const path = `/grupos/${authorSlug(group)}`;
  const { t } = useTranslation(['groups', 'common', 'authors']);
  const labels = useLabels();
  const q = useGroupQueries();
  const members = useQuery(q.members(group.id));
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t === params.get('tab')) ?? 'perfil';
  const setTab = (t: Tab) => setParams(t === 'perfil' ? {} : { tab: t }, { replace: true });

  // Metri-K no expone producción por grupo: se une la de los integrantes con perfil publicado.
  const published = (members.data ?? []).filter((m) => m.profilePublished);
  const profiles = useAuthorProfiles(published.map((m) => m.id));
  const productionReady = members.isSuccess && profiles.isSuccess;
  const products = useMemo(
    () =>
      mergeProducts(
        profiles.data.map((d) =>
          d?.kind === 'found' && d.author.production ? toProducts(d.author.production) : [],
        ),
      ),
    [profiles.data],
  );
  // Mismos filtros que la tabla de productos del investigador; una tarjeta de tipología la preselecciona.
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const showTypology = (t: TypologyId) => {
    setFilters({ ...EMPTY_FILTERS, typology: t });
    setTab('produccion');
  };
  const articles = products.filter((p) => p.type === 'Artículo científico').length;
  const productionHint = members.data
    ? t('detail.productionHint', { published: published.length, count: members.data.length })
    : t('common:loading');

  const leader = group.leader;
  const city = group.city ? displayName(group.city) : null;
  const history = group.categoryHistory;
  const lastConv = history[history.length - 1];
  const years = group.foundedYear ? new Date().getFullYear() - group.foundedYear : null;
  const lineNames = group.lines.map((l) => l.name);
  const isLeader = (m: GroupMember) => Boolean(leader) && fold(m.name) === fold(leader!.name);

  useDocumentMetadata({
    title: group.name,
    description: `${t('detail.metaBase', { name: group.name, code: group.code })}${
      group.category ? t('detail.metaCategory', { category: group.category }) : ''
    }${lineNames.length ? t('detail.metaLines', { lines: lineNames.slice(0, 3).join(', ') }) : ''}.`,
    path,
  });

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: group.name,
      identifier: group.code,
      url: absoluteUrl(path),
      parentOrganization: ORGANIZATION,
      ...(group.foundedYear ? { foundingDate: String(group.foundedYear) } : {}),
      ...(group.gruplacUrl ? { sameAs: group.gruplacUrl } : {}),
      ...(lineNames.length ? { knowsAbout: lineNames } : {}),
      ...(leader ? { member: { '@type': 'Person', name: displayName(leader.name), roleName: 'Líder' } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Grupos', item: absoluteUrl('/grupos') },
        { '@type': 'ListItem', position: 2, name: group.name, item: absoluteUrl(path) },
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
              <Link to="/grupos" className="hover:text-primary">
                {t('common:nav.items.groups.label')}
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" className="text-[16px]" />
            </li>
            <li aria-current="page" className="font-semibold text-on-surface">
              {group.code}
            </li>
          </ol>
        </nav>
      </div>

      <div className="container-page mt-gutter flex flex-col gap-5">
        {/* Encabezado */}
        <section
          className={`${card} relative flex flex-col items-start justify-between gap-5 overflow-hidden p-5 md:p-6 lg:flex-row lg:items-center`}
        >
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-surface-cream-alt/40" />
          <div className="z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-inner md:h-16 md:w-16">
              <Icon name="hub" className="text-[32px] md:text-[36px]" />
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-headline-lg-mobile font-bold tracking-tight text-primary md:text-headline-lg">
                {group.name}
              </h1>
              {/* Encabezado limpio: solo identidad. Líder y avalista van en Información institucional. */}
              {city ? (
                <p className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                  <Icon name="location_on" className="text-[16px] text-secondary" /> {city}
                </p>
              ) : null}
              <GroupCenters ids={group.centerIds} className="mt-1" />
            </div>
          </div>
          <div className="z-10 flex w-full shrink-0 flex-col items-center gap-2.5 sm:w-auto sm:flex-row lg:flex-col xl:flex-row print:hidden">
            {group.gruplacUrl ? (
              <a
                href={group.gruplacUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-secondary sm:w-auto"
              >
                {t('detail.viewGruplac')} <Icon name="open_in_new" className="text-[16px]" />
                <span className="sr-only">{t('common:newTab')}</span>
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-surface-cream-alt px-4 text-label-md font-semibold text-primary transition-colors hover:bg-badge-sage-bg sm:w-auto"
            >
              <Icon name="picture_as_pdf" className="text-[18px]" /> {t('detail.downloadPdf')}
            </button>
          </div>
        </section>

        <TabBar
          label={t('detail.tabsLabel')}
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: 'perfil', label: t('detail.tabProfile'), icon: 'analytics' },
            { id: 'integrantes', label: t('detail.tabMembers'), icon: 'group', badge: members.data?.length },
            {
              id: 'produccion',
              label: t('detail.tabProduction'),
              icon: 'menu_book',
              badge: productionReady ? products.length : undefined,
            },
          ]}
        />

        {/* Perfil e indicadores */}
        <div id="panel-perfil" role="tabpanel" aria-labelledby="tab-perfil" hidden={tab !== 'perfil'}>
          <div className="flex flex-col gap-5">
            <section className={`${card} p-5 md:p-6`}>
              <SectionHead icon="corporate_fare">{t('detail.institutional')}</SectionHead>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                <InfoColumn icon="badge" title={t('detail.identification')}>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t('detail.code')}>
                      <span className="font-mono text-primary">{group.code}</span>
                    </Field>
                    <Field label={t('detail.foundedYear')}>
                      {group.foundedYear
                        ? years
                          ? t('detail.age', { year: group.foundedYear, count: years })
                          : group.foundedYear
                        : '—'}
                    </Field>
                  </div>
                  <Field label={t('detail.status')}>
                    <span className="inline-flex items-center gap-1.5 text-secondary">
                      <span className="h-2 w-2 rounded-full bg-secondary" /> {t('detail.active')}
                    </span>
                  </Field>
                </InfoColumn>
                <InfoColumn icon="school" title={t('detail.classification')}>
                  <Field label={t('detail.currentClass')}>
                    <span
                      className={`inline-flex min-w-10 justify-center rounded-lg px-2.5 py-0.5 text-headline-sm font-bold ${categoryTone(group.category)}`}
                    >
                      {group.category ? labels.domain(group.category) : '—'}
                    </span>
                  </Field>
                  <Field label={t('detail.convocation')}>
                    {lastConv ? labels.convocation(lastConv.convocation) : '—'}
                  </Field>
                  <Field label={t('detail.type')}>{group.type ? labels.domain(group.type) : '—'}</Field>
                </InfoColumn>
                <InfoColumn icon="account_balance" title={t('detail.structure')}>
                  <Field label={t('detail.endorser')}>Universidad Simón Bolívar</Field>
                  <Field label={t('detail.campus')}>
                    {[city, group.department && displayName(group.department)].filter(Boolean).join(', ') ||
                      '—'}
                  </Field>
                  <Field label={t('detail.groupLeader')}>{leader ? displayName(leader.name) : '—'}</Field>
                </InfoColumn>
              </div>
            </section>

            {/* Líneas de investigación + ODS vinculados (bloque 3 de la plantilla) */}
            <section
              className={`${card} flex flex-col items-stretch gap-6 p-5 md:p-6 lg:flex-row`}
              aria-label={t('detail.linesAndOds')}
            >
              <ResearchLines lines={group.lines} />
              <div className="flex shrink-0 flex-col lg:w-[22rem] xl:w-[26rem]">
                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2.5 text-headline-sm font-bold tracking-tight text-primary">
                    <Icon name="public" className="text-[24px] text-secondary" /> {t('detail.odsLinked')}
                  </h3>
                  <span className="rounded-full bg-surface-cream-alt px-3 py-1 text-[12px] font-medium text-on-surface-variant">
                    {t('detail.agenda')}
                  </span>
                </div>
                <OdsLinked ods={group.ods} />
              </div>
            </section>

            <section
              className="grid grid-cols-2 gap-gutter lg:grid-cols-4"
              aria-label={t('detail.indicators')}
            >
              <Kpi
                label={t('detail.kpiMembers')}
                icon="groups"
                value={members.data?.length ?? '—'}
                caption={t('detail.kpiMembersCaption')}
                hint={
                  members.data
                    ? t('detail.kpiMembersHint', { count: members.data.filter((m) => m.category).length })
                    : t('common:loading')
                }
              />
              <Kpi
                label={t('detail.kpiTrajectory')}
                icon="military_tech"
                value={years ?? '—'}
                caption={t('detail.kpiYearsCaption')}
                hint={
                  group.foundedYear
                    ? t('detail.kpiFounded', { year: group.foundedYear, count: history.length })
                    : t('detail.kpiConvocations', { count: history.length })
                }
              />
              <Kpi
                label={t('detail.kpiPublications')}
                icon="article"
                value={productionReady ? articles : '—'}
                caption={t('detail.kpiArticlesCaption')}
                hint={t('detail.kpiScopus')}
              />
              <Kpi
                label={t('detail.kpiTotal')}
                icon="workspace_premium"
                value={productionReady ? products.length : '—'}
                caption={t('detail.kpiTotalCaption')}
                hint={productionHint}
                accent
              />
            </section>

            <section className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
              <div>
                <h2 className="text-headline-md font-semibold text-primary">{t('detail.historyTitle')}</h2>
                <p className="text-body-sm text-on-surface-variant">{t('detail.historyLead')}</p>
              </div>
              <CategoryTimeline history={history} />
            </section>

            <section className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
              <div>
                <h2 className="text-headline-md font-semibold text-primary">{t('detail.typologyTitle')}</h2>
                <p className="text-body-sm text-on-surface-variant">{t('detail.typologyLead')}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {TYPOLOGIES.map((t) => (
                  <TypologyCard
                    key={t.id}
                    typology={t.id}
                    count={products.filter((p) => p.typology === t.id).length}
                    total={products.length}
                    loading={!productionReady}
                    onExplore={() => showTypology(t.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Integrantes */}
        <div
          id="panel-integrantes"
          role="tabpanel"
          aria-labelledby="tab-integrantes"
          hidden={tab !== 'integrantes'}
        >
          {members.isError ? (
            <ErrorState error={members.error} onRetry={() => members.refetch()} />
          ) : (
            <Members members={members.data} isLeader={isLeader} />
          )}
        </div>

        {/* Producción científica */}
        <div
          id="panel-produccion"
          role="tabpanel"
          aria-labelledby="tab-produccion"
          hidden={tab !== 'produccion'}
        >
          {profiles.isError ? (
            <ErrorState message={t('detail.productionError')} onRetry={profiles.refetch} />
          ) : productionReady ? (
            <GroupProduction
              products={products}
              filters={filters}
              onFiltersChange={setFilters}
              note={productionHint}
            />
          ) : (
            <div
              aria-busy="true"
              aria-label={t('detail.loadingProduction')}
              className={`${card} h-48 animate-pulse`}
            />
          )}
        </div>

        <Link
          to="/grupos"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> {t('detail.back')}
        </Link>
      </div>
    </article>
  );
}

/** Metri-K trae algunos nombres en minúscula ("frontera y derechos humanos"). */
const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** Nombre y textos de cada línea: libres, del backend; se traducen en el navegador (no son nombres propios). */
const LINES_PREVIEW = 6;

function ResearchLines({ lines }: { lines: GroupLine[] }) {
  const { t } = useTranslation(['groups', 'common']);
  const stride = 1 + LINE_FIELDS.length;
  const tr = useAutoTranslate(lines.flatMap((l) => [l.name, ...LINE_FIELDS.map((f) => l[f.key] ?? '')]));
  const text = (line: number, field: number) => tr.texts[line * stride + field];
  // Sin traducir en una interfaz en otro idioma, el texto se marca como español (lectores de pantalla).
  const lang = sourceLang(tr.status);
  // Más de 6 líneas: se muestran 6 y el resto con «Ver más líneas».
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? lines : lines.slice(0, LINES_PREVIEW);
  const hidden = lines.length - LINES_PREVIEW;
  return (
    <div className="flex-1 border-border-subtle/60 pb-6 lg:border-r lg:pr-6 lg:pb-0 max-lg:border-b">
      <h3 className="mb-3.5 flex items-center gap-2 text-headline-sm font-bold tracking-tight text-primary">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-secondary">
          <Icon name="checklist_rtl" className="text-[20px]" />
        </span>
        {t('detail.lines')}
      </h3>
      <AutoTranslateNote status={tr.status} onRetry={tr.retry} />
      {tr.status === 'pending' && lines.length ? (
        // Skeleton con la misma forma que las líneas: no se ve el español antes de la traducción.
        <div
          aria-busy="true"
          aria-label={t('common:autoTranslate.pending')}
          className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2"
        >
          {shown.map((line, i) => (
            <div
              key={line.id}
              className="flex items-center gap-2.5 rounded-xl border border-border-subtle/80 bg-canvas-cream p-3"
            >
              <span className="h-[18px] w-[18px] shrink-0 animate-pulse rounded-full bg-surface-cream-alt motion-reduce:animate-none" />
              <span
                className="h-3.5 animate-pulse rounded bg-surface-cream-alt motion-reduce:animate-none"
                style={{ width: `${55 + ((i * 17) % 35)}%` }}
              />
            </div>
          ))}
        </div>
      ) : lines.length ? (
        <div lang={lang} className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
          {shown.map((line, i) => {
            const fields = LINE_FIELDS.filter((f) => line[f.key]);
            return (
              <details
                key={line.id}
                className="group/line rounded-xl border border-border-subtle/80 bg-canvas-cream transition-colors open:bg-surface-container-lowest hover:bg-surface-cream-alt"
              >
                <summary
                  className={`flex list-none items-center gap-2.5 p-3 [&::-webkit-details-marker]:hidden ${
                    fields.length ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  onClick={(e) => {
                    if (!fields.length) e.preventDefault();
                  }}
                >
                  <Icon name="check_circle" className="text-[18px] text-secondary" />
                  <span className="flex-1 text-body-sm leading-tight font-medium text-on-surface">
                    {capitalize(text(i, 0)!)}
                  </span>
                  {fields.length ? (
                    <Icon
                      name="expand_more"
                      className="text-[18px] text-neutral-muted transition-transform group-open/line:rotate-180"
                    />
                  ) : null}
                </summary>
                {fields.length ? (
                  <dl className="flex flex-col gap-3 border-t border-surface-cream-alt px-4 pt-3 pb-4">
                    {fields.map((f) => (
                      <div key={f.key}>
                        <dt className="flex items-center gap-1.5 text-label-md font-semibold text-secondary">
                          <Icon name={f.icon} className="text-[16px]" /> {t(f.label)}
                        </dt>
                        <dd className="mt-1 text-body-sm whitespace-pre-line text-on-surface-variant">
                          {text(i, 1 + LINE_FIELDS.indexOf(f))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </details>
            );
          })}
          {hidden > 0 ? (
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((v) => !v)}
              className="inline-flex items-center justify-center gap-1 justify-self-start rounded-lg px-3 py-2 text-label-md font-semibold text-secondary transition-colors hover:bg-surface-cream-alt sm:col-span-2"
            >
              {showAll ? t('detail.lessLines') : t('detail.moreLines', { count: hidden })}
              <Icon
                name="expand_more"
                className={`text-[18px] transition-transform ${showAll ? 'rotate-180' : ''}`}
              />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-body-sm text-neutral-muted">{t('detail.noLines')}</p>
      )}
    </div>
  );
}

function Members({
  members,
  isLeader,
}: {
  members: GroupMember[] | undefined;
  isLeader: (m: GroupMember) => boolean;
}) {
  const { t, i18n } = useTranslation(['groups', 'common', 'authors']);
  const labels = useLabels();
  const [term, setTerm] = useState('');
  if (!members)
    return (
      <div aria-busy="true" aria-label={t('members.loading')} className={`${card} h-48 animate-pulse`} />
    );

  const rank = (m: GroupMember) =>
    isLeader(m)
      ? -1
      : AUTHOR_CATEGORIES.findIndex((c) => c.id === m.category) + 1 || AUTHOR_CATEGORIES.length + 1;
  const q = fold(term);
  const visible = [...members]
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, i18n.resolvedLanguage))
    .filter(
      (m) => !q || fold(m.name).includes(q) || (m.category && fold(labels.category(m.category)).includes(q)),
    );

  return (
    <section className={`${card} flex flex-col gap-5 p-5 md:p-6`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-headline-md font-semibold text-primary">{t('members.title')}</h2>
          <p className="text-body-sm text-on-surface-variant">
            {t('members.lead', { count: members.length })}
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute top-2.5 left-3 text-[20px] text-on-surface-variant"
          />
          <label htmlFor="member-search" className="sr-only">
            {t('members.search')}
          </label>
          <input
            id="member-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('members.searchPlaceholder')}
            className="h-10 w-full rounded-lg bg-canvas-cream pr-3 pl-10 text-body-sm focus:ring-2 focus:ring-secondary focus:outline-none"
          />
        </div>
      </div>

      {visible.length ? (
        <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => (
            <MemberCard key={m.id} member={m} leader={isLeader(m)} />
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-body-md text-neutral-muted">{t('members.none')}</p>
      )}
    </section>
  );
}

function MemberCard({ member: m, leader }: { member: GroupMember; leader: boolean }) {
  const name = displayName(m.name);
  const cat = categoryOf(m.category);
  const profiles = externalProfiles(m);
  const cvlac = profiles.find((p) => p.label === 'CvLAC');
  const { t } = useTranslation(['groups', 'common', 'authors']);
  const labels = useLabels();
  return (
    <li className="flex flex-col justify-between rounded-xl bg-canvas-cream p-5 transition-all hover:shadow-md">
      <div>
        <div className="flex items-center gap-4">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-dark-forest text-headline-sm font-bold text-secondary-fixed shadow-sm">
            {m.photoUrl ? (
              <img
                src={withBaseUrl(m.photoUrl)}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              initials(name)
            )}
          </span>
          <div className="min-w-0">
            <span className="rounded-full bg-badge-sage-bg px-2 py-0.5 text-label-sm font-bold text-badge-sage-text">
              {leader ? t('members.leader') : cat ? labels.researcher(cat.id) : t('members.member')}
            </span>
            <h3 className="mt-1 text-headline-sm leading-snug font-semibold text-primary">{name}</h3>
            {m.degree ? <p className="text-[12px] text-neutral-muted">{labels.domain(m.degree)}</p> : null}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-surface-container-lowest p-2 text-[12px]">
          {m.metrics ? (
            <>
              <span>
                <strong className="font-bold text-primary">{m.metrics.scopusPublications}</strong>{' '}
                {t('members.pubs')}
              </span>
              <span className="text-neutral-muted">|</span>
              <span>
                {t('members.hIndex')}{' '}
                <strong className="font-bold text-secondary">{m.metrics.hIndex ?? '—'}</strong>
              </span>
            </>
          ) : (
            <>
              <span>
                {t('members.category')} <strong className="font-bold text-primary">{cat?.code ?? '—'}</strong>
              </span>
              <span className="text-neutral-muted">|</span>
              <span>
                {t('members.profiles')}{' '}
                <strong className="font-bold text-secondary">{profiles.length}</strong>
              </span>
            </>
          )}
          <span className="text-neutral-muted">|</span>
          <span>Unisimón</span>
        </div>
      </div>
      {m.profilePublished ? (
        <Link
          to={`/investigadores/${authorSlug(m)}`}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary text-label-sm font-semibold text-on-primary transition-colors hover:bg-secondary"
        >
          {t('members.viewProfile')}
        </Link>
      ) : cvlac ? (
        <a
          href={cvlac.url}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-border-subtle text-label-sm font-semibold text-primary transition-colors hover:bg-surface-container-lowest"
        >
          {t('members.viewCvlac')} <Icon name="open_in_new" className="text-[14px]" />
          <span className="sr-only">{t('common:newTab')}</span>
        </a>
      ) : null}
    </li>
  );
}

function Kpi({
  label,
  icon,
  value,
  caption,
  hint,
  accent = false,
}: {
  label: string;
  icon: string;
  value: ReactNode;
  caption: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className={`${card} flex flex-col justify-between p-4 transition-all hover:-translate-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-label-sm tracking-wider text-neutral-muted uppercase">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            accent ? 'bg-badge-sage-bg text-secondary' : 'bg-surface-cream-alt text-primary'
          }`}
        >
          <Icon name={icon} className="text-[18px]" />
        </span>
      </div>
      <div className="mt-3">
        <span className={`text-stat-metric font-bold ${accent ? 'text-secondary' : 'text-primary'}`}>
          {value}
        </span>
        <span className="block text-body-sm font-medium text-on-surface">{caption}</span>
        <span className="mt-0.5 block text-[12px] text-neutral-muted">{hint}</span>
      </div>
    </div>
  );
}

/** Producción del grupo: la misma tabla (filtros incluidos) que los productos del investigador. */
function GroupProduction({
  products,
  filters,
  onFiltersChange,
  note,
}: {
  products: Product[];
  filters: ProductFilters;
  onFiltersChange: (f: ProductFilters) => void;
  note: string;
}) {
  const { t } = useTranslation('groups');
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-headline-md font-semibold text-primary">{t('production.title')}</h2>
        <p className="text-body-sm text-on-surface-variant">
          {t('production.lead', { count: products.length, note })}
        </p>
      </div>
      <ProductsTable products={products} filters={filters} onFiltersChange={onFiltersChange} />
    </section>
  );
}
