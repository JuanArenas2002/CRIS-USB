import { useContext, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
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
import type { GroupDetail, GroupMember } from '@/domain/groups/group';
import { CategoryTimeline } from '@/presentation/components/groups/CategoryTimeline';
import { OdsLinked } from '@/presentation/components/groups/OdsIcons';
import { ErrorState } from '@/presentation/components/feedback/Feedback';
import { Icon } from '@/presentation/components/ui/Icon';
import { TabBar } from '@/presentation/components/ui/TabBar';
import { TypologyCard, TYPOLOGY_STYLE } from '@/presentation/components/ui/TypologyCard';
import { useAuthorProfiles } from '@/presentation/hooks/use-authors';
import { useDocumentMetadata } from '@/presentation/hooks/use-document-metadata';
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

  if (id === null || data?.kind === 'not-found') return <NotFoundPage />;
  if (data?.kind === 'found') {
    const canonical = authorSlug(data.group);
    if (slug !== canonical) return <Navigate replace to={`/grupos/${canonical}${search}`} />;
    return <GroupProfile group={data.group} />;
  }
  return (
    <div className="container-page py-16">
      {isError ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : (
        <div
          aria-busy="true"
          aria-label="Cargando grupo"
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
  { key: 'objective', label: 'Objetivo', icon: 'flag' },
  { key: 'achievements', label: 'Logros', icon: 'emoji_events' },
  { key: 'impact', label: 'Impacto', icon: 'bolt' },
] as const;

function GroupProfile({ group }: { group: GroupDetail }) {
  const path = `/grupos/${authorSlug(group)}`;
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
  const [typology, setTypology] = useState<TypologyId | ''>('');
  const showTypology = (t: TypologyId) => {
    setTypology(t);
    setTab('produccion');
  };
  const articles = products.filter((p) => p.type === 'Artículo científico').length;
  const productionHint = members.data
    ? `${published.length} de ${members.data.length} integrantes con perfil publicado`
    : 'Cargando…';

  const leader = group.leader;
  const city = group.city ? displayName(group.city) : null;
  const history = group.categoryHistory;
  const lastConv = history[history.length - 1];
  const years = group.foundedYear ? new Date().getFullYear() - group.foundedYear : null;
  const lineNames = group.lines.map((l) => l.name);
  const isLeader = (m: GroupMember) => Boolean(leader) && fold(m.name) === fold(leader!.name);

  useDocumentMetadata({
    title: group.name,
    description: `Grupo de investigación ${group.name} (${group.code}) de la Universidad Simón Bolívar${
      group.category ? `, categoría ${group.category} Minciencias` : ''
    }${lineNames.length ? `. Líneas: ${lineNames.slice(0, 3).join(', ')}` : ''}.`,
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
        <nav aria-label="Ruta de navegación" className="container-page py-3">
          <ol className="flex flex-wrap items-center gap-1 text-label-md text-neutral-muted">
            <li>
              <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
                <Icon name="home" className="text-[16px]" /> Inicio
              </Link>
            </li>
            <li aria-hidden="true">
              <Icon name="chevron_right" className="text-[16px]" />
            </li>
            <li>
              <Link to="/grupos" className="hover:text-primary">
                Grupos
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
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
                {leader ? (
                  <span className="flex items-center gap-1.5 font-medium text-primary">
                    <Icon name="verified_user" className="text-[16px] text-secondary" />
                    Líder: {displayName(leader.name)}
                  </span>
                ) : null}
                {leader ? <span className="text-neutral-muted">·</span> : null}
                <span>Universidad Simón Bolívar{city ? ` (${city})` : ''}</span>
              </p>
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
                Ver en GrupLAC <Icon name="open_in_new" className="text-[16px]" />
                <span className="sr-only">(abre en una pestaña nueva)</span>
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-surface-cream-alt px-4 text-label-md font-semibold text-primary transition-colors hover:bg-badge-sage-bg sm:w-auto"
            >
              <Icon name="picture_as_pdf" className="text-[18px]" /> Descargar ficha PDF
            </button>
          </div>
        </section>

        <TabBar
          label="Secciones del grupo de investigación"
          active={tab}
          onSelect={setTab}
          tabs={[
            { id: 'perfil', label: 'Perfil e indicadores', icon: 'analytics' },
            { id: 'integrantes', label: 'Integrantes', icon: 'group', badge: members.data?.length },
            {
              id: 'produccion',
              label: 'Producción científica',
              icon: 'menu_book',
              badge: productionReady ? products.length : undefined,
            },
          ]}
        />

        {/* Perfil e indicadores */}
        <div id="panel-perfil" role="tabpanel" aria-labelledby="tab-perfil" hidden={tab !== 'perfil'}>
          <div className="flex flex-col gap-5">
            <section className={`${card} p-5 md:p-6`}>
              <SectionHead icon="corporate_fare">Información institucional</SectionHead>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                <InfoColumn icon="badge" title="Identificación">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Código GrupLAC">
                      <span className="font-mono text-primary">{group.code}</span>
                    </Field>
                    <Field label="Año de creación">
                      {group.foundedYear ? `${group.foundedYear}${years ? ` (${years} años)` : ''}` : '—'}
                    </Field>
                  </div>
                  <Field label="Estado">
                    <span className="inline-flex items-center gap-1.5 text-secondary">
                      <span className="h-2 w-2 rounded-full bg-secondary" /> Activo
                    </span>
                  </Field>
                </InfoColumn>
                <InfoColumn icon="school" title="Clasificación">
                  <Field label="Clasificación actual">
                    <span className="text-headline-sm font-bold text-primary">{group.category ?? '—'}</span>
                  </Field>
                  <Field label="Convocatoria oficial">{lastConv?.convocation ?? '—'}</Field>
                  <Field label="Tipo de grupo">{group.type ?? '—'}</Field>
                </InfoColumn>
                <InfoColumn icon="account_balance" title="Estructura">
                  <Field label="Institución avaladora principal">Universidad Simón Bolívar</Field>
                  <Field label="Sede académica">
                    {[city, group.department && displayName(group.department)].filter(Boolean).join(', ') ||
                      '—'}
                  </Field>
                  <Field label="Líder del grupo">{leader ? displayName(leader.name) : '—'}</Field>
                </InfoColumn>
              </div>
            </section>

            {/* Líneas de investigación + ODS vinculados (bloque 3 de la plantilla) */}
            <section
              className={`${card} flex flex-col items-stretch gap-6 p-5 md:p-6 lg:flex-row`}
              aria-label="Líneas de investigación y ODS vinculados"
            >
              <div className="flex-1 border-border-subtle/60 pb-6 lg:border-r lg:pr-6 lg:pb-0 max-lg:border-b">
                <h3 className="mb-3.5 flex items-center gap-2 text-headline-sm font-bold tracking-tight text-primary">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-secondary">
                    <Icon name="checklist_rtl" className="text-[20px]" />
                  </span>
                  Líneas de investigación
                </h3>
                {group.lines.length ? (
                  <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
                    {group.lines.map((line) => {
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
                              {line.name}
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
                                    <Icon name={f.icon} className="text-[16px]" /> {f.label}
                                  </dt>
                                  <dd className="mt-1 text-body-sm whitespace-pre-line text-on-surface-variant">
                                    {line[f.key]}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </details>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-body-sm text-neutral-muted">Sin líneas registradas en Metri-K.</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col lg:w-[22rem] xl:w-[26rem]">
                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2.5 text-headline-sm font-bold tracking-tight text-primary">
                    <Icon name="public" className="text-[24px] text-secondary" /> ODS vinculados
                  </h3>
                  <span className="rounded-full bg-surface-cream-alt px-3 py-1 text-[12px] font-medium text-on-surface-variant">
                    Agenda 2030
                  </span>
                </div>
                <OdsLinked ods={group.ods} />
              </div>
            </section>

            <section
              className="grid grid-cols-2 gap-gutter lg:grid-cols-4"
              aria-label="Indicadores del grupo"
            >
              <Kpi
                label="Integrantes"
                icon="groups"
                value={members.data?.length ?? '—'}
                caption="Investigadores activos"
                hint={
                  members.data
                    ? `${members.data.filter((m) => m.category).length} con categoría Minciencias`
                    : 'Cargando…'
                }
              />
              <Kpi
                label="Trayectoria"
                icon="military_tech"
                value={years ?? '—'}
                caption="Años de actividad"
                hint={
                  group.foundedYear
                    ? `Fundado en ${group.foundedYear} · ${history.length} convocatorias`
                    : `${history.length} convocatorias Minciencias`
                }
              />
              <Kpi
                label="Publicaciones"
                icon="article"
                value={productionReady ? articles : '—'}
                caption="Artículos científicos"
                hint="Indexados en Scopus"
              />
              <Kpi
                label="Producción total"
                icon="workspace_premium"
                value={productionReady ? products.length : '—'}
                caption="Productos registrados"
                hint={productionHint}
                accent
              />
            </section>

            <section className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
              <div>
                <h2 className="text-headline-md font-semibold text-primary">
                  Histórico de clasificación Minciencias
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  Evolución ordinal del grupo en las convocatorias oficiales del Sistema Nacional de Ciencia,
                  Tecnología e Innovación
                </p>
              </div>
              <CategoryTimeline history={history} />
            </section>

            <section className={`${card} flex flex-col gap-4 p-5 md:p-6`}>
              <div>
                <h2 className="text-headline-md font-semibold text-primary">
                  Producción por tipología Minciencias
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  Productos de los integrantes con perfil publicado, en las cuatro grandes tipologías del
                  modelo de medición
                </p>
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
            <ErrorState message={members.error.message} onRetry={() => members.refetch()} />
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
            <ErrorState
              message="No se pudo cargar la producción de los integrantes."
              onRetry={profiles.refetch}
            />
          ) : productionReady ? (
            <GroupProduction
              products={products}
              typology={typology}
              onTypology={setTypology}
              note={productionHint}
            />
          ) : (
            <div aria-busy="true" aria-label="Cargando producción" className={`${card} h-48 animate-pulse`} />
          )}
        </div>

        <Link
          to="/grupos"
          className="inline-flex items-center gap-1 text-label-md font-semibold text-primary hover:underline"
        >
          <Icon name="chevron_left" className="text-[18px]" /> Volver a grupos
        </Link>
      </div>
    </article>
  );
}

function Members({
  members,
  isLeader,
}: {
  members: GroupMember[] | undefined;
  isLeader: (m: GroupMember) => boolean;
}) {
  const [term, setTerm] = useState('');
  if (!members)
    return (
      <div aria-busy="true" aria-label="Cargando integrantes" className={`${card} h-48 animate-pulse`} />
    );

  const rank = (m: GroupMember) =>
    isLeader(m)
      ? -1
      : AUTHOR_CATEGORIES.findIndex((c) => c.id === m.category) + 1 || AUTHOR_CATEGORIES.length + 1;
  const q = fold(term);
  const visible = [...members]
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'))
    .filter((m) => !q || fold(m.name).includes(q) || fold(categoryOf(m.category)?.label ?? '').includes(q));

  return (
    <section className={`${card} flex flex-col gap-5 p-5 md:p-6`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-headline-md font-semibold text-primary">Integrantes del grupo</h2>
          <p className="text-body-sm text-on-surface-variant">
            {members.length} investigadores activos en GrupLAC vinculados al grupo
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute top-2.5 left-3 text-[20px] text-on-surface-variant"
          />
          <label htmlFor="member-search" className="sr-only">
            Buscar integrantes
          </label>
          <input
            id="member-search"
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o categoría…"
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
        <p className="py-8 text-center text-body-md text-neutral-muted">
          Ningún integrante coincide con la búsqueda.
        </p>
      )}
    </section>
  );
}

function MemberCard({ member: m, leader }: { member: GroupMember; leader: boolean }) {
  const name = displayName(m.name);
  const cat = categoryOf(m.category);
  const profiles = externalProfiles(m);
  const cvlac = profiles.find((p) => p.label === 'CvLAC');
  return (
    <li className="flex flex-col justify-between rounded-xl bg-canvas-cream p-5 transition-all hover:shadow-md">
      <div>
        <div className="flex items-center gap-4">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-dark-forest text-headline-sm font-bold text-secondary-fixed shadow-sm">
            {m.photoUrl ? (
              <img
                src={m.photoUrl}
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
              {leader ? 'Líder del grupo' : cat ? `Investigador ${cat.label}` : 'Integrante'}
            </span>
            <h3 className="mt-1 text-headline-sm leading-snug font-semibold text-primary">{name}</h3>
            {m.degree ? <p className="text-[12px] text-neutral-muted">{m.degree}</p> : null}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-surface-container-lowest p-2 text-[12px]">
          {m.metrics ? (
            <>
              <span>
                <strong className="font-bold text-primary">{m.metrics.scopusPublications}</strong> pubs
              </span>
              <span className="text-neutral-muted">|</span>
              <span>
                Índice h: <strong className="font-bold text-secondary">{m.metrics.hIndex ?? '—'}</strong>
              </span>
            </>
          ) : (
            <>
              <span>
                Categoría: <strong className="font-bold text-primary">{cat?.code ?? '—'}</strong>
              </span>
              <span className="text-neutral-muted">|</span>
              <span>
                Perfiles: <strong className="font-bold text-secondary">{profiles.length}</strong>
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
          Ver perfil del investigador →
        </Link>
      ) : cvlac ? (
        <a
          href={cvlac.url}
          target="_blank"
          rel="noopener"
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-border-subtle text-label-sm font-semibold text-primary transition-colors hover:bg-surface-container-lowest"
        >
          Ver CvLAC <Icon name="open_in_new" className="text-[14px]" />
          <span className="sr-only">(abre en una pestaña nueva)</span>
        </a>
      ) : null}
    </li>
  );
}

function SectionHead({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface-cream-alt/40 p-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-badge-sage-bg text-badge-sage-text">
        <Icon name={icon} className="text-[20px]" />
      </span>
      <h2 className="text-headline-md font-semibold text-primary">{children}</h2>
    </div>
  );
}

function InfoColumn({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 pb-1 text-label-md tracking-wider text-secondary uppercase">
        <Icon name={icon} className="text-[16px]" /> {title}
      </h3>
      <dl className="flex flex-col gap-2.5 text-body-sm">{children}</dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="block text-label-sm text-neutral-muted">{label}</dt>
      <dd className="font-semibold text-on-surface">{children}</dd>
    </div>
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

const PRODUCTS_PAGE = 20;

function GroupProduction({
  products,
  typology,
  onTypology,
  note,
}: {
  products: Product[];
  typology: TypologyId | '';
  onTypology: (t: TypologyId | '') => void;
  note: string;
}) {
  const [limit, setLimit] = useState(PRODUCTS_PAGE);
  const visible = products.filter((p) => !typology || p.typology === typology);
  const chips: { id: TypologyId | ''; label: string; n: number }[] = [
    { id: '', label: 'Todos', n: products.length },
    ...TYPOLOGIES.map((t) => ({
      id: t.id,
      label: t.short,
      n: products.filter((p) => p.typology === t.id).length,
    })),
  ];
  const select = (t: TypologyId | '') => {
    setLimit(PRODUCTS_PAGE);
    onTypology(t);
  };

  return (
    <section className={`${card} flex flex-col gap-5 p-5 md:p-6`}>
      <div>
        <h2 className="text-headline-md font-semibold text-primary">Producción científica y tecnológica</h2>
        <p className="text-body-sm text-on-surface-variant">
          {products.length} productos por tipología Minciencias · {note}
        </p>
      </div>
      <div role="group" aria-label="Filtrar por tipología" className="flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            aria-pressed={typology === c.id}
            disabled={!c.n}
            onClick={() => select(c.id)}
            className={`rounded-full px-4 py-1.5 text-label-sm font-semibold transition-all disabled:cursor-default disabled:opacity-50 ${
              typology === c.id
                ? 'bg-primary text-on-primary'
                : 'bg-canvas-cream text-on-surface-variant enabled:hover:bg-badge-sage-bg'
            }`}
          >
            {c.label} ({c.n})
          </button>
        ))}
      </div>

      {visible.length ? (
        <ul className="flex flex-col gap-3">
          {visible.slice(0, limit).map((p) => (
            <ProductItem key={p.key} product={p} />
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-body-md text-neutral-muted">
          No hay productos registrados en Metri-K para los integrantes con perfil publicado.
        </p>
      )}
      {visible.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PRODUCTS_PAGE)}
          className="self-center rounded-lg border border-border-subtle px-5 py-2 text-label-md font-semibold text-primary transition-colors hover:bg-surface-cream-alt"
        >
          Ver más ({visible.length - limit} restantes)
        </button>
      ) : null}
    </section>
  );
}

function ProductItem({ product: p }: { product: Product }) {
  const t = TYPOLOGIES.find((x) => x.id === p.typology)!;
  const style = TYPOLOGY_STYLE[p.typology];
  return (
    <li className="flex flex-col items-start justify-between gap-4 rounded-xl bg-canvas-cream p-4 transition-all hover:bg-surface-cream-alt sm:flex-row">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.iconBox}`}
        >
          <Icon name={t.icon} className="text-[18px]" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-label-sm font-bold ${style.chip}`}>
              {t.label}
            </span>
            <span className="font-mono text-[12px] font-semibold text-secondary">{p.type}</span>
            {p.year ? <span className="text-[12px] text-neutral-muted">{p.year}</span> : null}
          </p>
          <h3 className="text-headline-sm font-semibold text-primary">{p.title}</h3>
          {p.authors || p.venue ? (
            <p className="text-body-sm text-on-surface-variant">
              {p.authors}
              {p.authors && p.venue ? ' — ' : null}
              {p.venue ? <em>{p.venue}</em> : null}
            </p>
          ) : null}
          {p.doi || p.index ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-4 text-[12px] font-medium text-secondary">
              {p.doi ? <span>DOI: {p.doi}</span> : null}
              {p.index ? <span>{p.index}</span> : null}
            </p>
          ) : null}
        </div>
      </div>
      {p.url ? (
        <a
          href={p.url}
          target="_blank"
          rel="noopener"
          className="inline-flex shrink-0 items-center gap-1 self-end text-label-sm font-semibold text-primary hover:text-secondary sm:self-center"
        >
          {p.doi ? 'Ver DOI' : 'Ver producto'} <Icon name="open_in_new" className="text-[16px]" />
          <span className="sr-only">(abre en una pestaña nueva)</span>
        </a>
      ) : null}
    </li>
  );
}
