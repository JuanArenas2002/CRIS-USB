import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { newsApi, responsiveImage, type News, type NewsFilter } from '@/infrastructure/news/news-api';
import { Drawer } from '@/presentation/components/admin/Drawer';
import { Icon } from '@/presentation/components/ui/Icon';
import { KEYS, useCatalogs, useOrg } from './queries';
import {
  Badge,
  Button,
  ErrorLine,
  Field,
  Input,
  LINK_BUTTON,
  Loading,
  PageHeader,
  ROOT,
  STATUS_TONE,
  Select,
  StatusLine,
  fmtDate,
  useAction,
  useAdminSession,
} from './ui';

const LIMIT = 20;
const TABS = [
  { status: undefined, label: 'Todas' },
  { status: 'draft', label: 'Borradores' },
  { status: 'in_review', label: 'Por revisar' },
  { status: 'rejected', label: 'Con cambios pedidos' },
  { status: 'approved', label: 'Por publicar' },
  { status: 'scheduled', label: 'Programadas' },
  { status: 'published', label: 'Publicadas' },
  { status: 'archived', label: 'Archivadas' },
];

/** Lo que toca hacer con la noticia, según su estado y los permisos del usuario. */
function nextStep(n: News, can: (code: string) => boolean): string | null {
  switch (n.status) {
    case 'draft':
      return can('news.submit') ? 'Terminar y enviar a revisión' : null;
    case 'rejected':
      return can('news.submit') ? 'Corregir y reenviar' : null;
    case 'in_review':
      return can('news.approve') || can('news.review') ? 'Revisar' : 'Esperando revisión';
    case 'approved':
      return can('news.publish') ? 'Publicar' : 'Esperando publicación';
    default:
      return null;
  }
}

/** Listado interno: el backend ya lo limita a las dependencias donde el usuario tiene news.view. */
export function NewsListView() {
  const { can } = useAdminSession();
  const catalogs = useCatalogs();
  const { units, scopeName } = useOrg();
  const [filter, setFilter] = useState<NewsFilter>({ limit: LIMIT, offset: 0 });
  const [more, setMore] = useState(false);
  const [categories, setCategories] = useState(false);
  const set = (patch: Partial<NewsFilter>) => setFilter((f) => ({ ...f, offset: 0, ...patch }));
  const news = useQuery({
    queryKey: [...KEYS.news, filter],
    queryFn: () => newsApi.list(filter),
    placeholderData: keepPreviousData,
  });
  const statusName = (code: string) => catalogs.data?.statuses.find((s) => s.code === code)?.name ?? code;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Noticias"
        description="Crea, revisa y publica las noticias científicas de las dependencias donde tienes permiso."
        actions={
          <>
            {can('news.manage_categories') && <Button onClick={() => setCategories(true)}>Categorías</Button>}
            {can('news.create') && (
              <Link to={`${ROOT}/nueva`} className={LINK_BUTTON}>
                <Icon name="add" className="text-[20px]" /> Nueva noticia
              </Link>
            )}
          </>
        }
      />

      <section
        aria-label="Listado de noticias"
        className="rounded-xl border border-border-subtle bg-surface-container-lowest"
      >
        {/* Pestañas de etapa (subrayado, desplazables en pantallas angostas). */}
        <nav aria-label="Etapas" className="overflow-x-auto border-b border-border-subtle px-2 sm:px-4">
          <ul className="flex min-w-max gap-1">
            {TABS.map((t) => {
              const active = filter.status === t.status;
              return (
                <li key={t.label}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ status: t.status })}
                    className={`relative h-12 px-3 text-label-md font-semibold transition-colors ${
                      active
                        ? 'text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-secondary'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-b border-border-subtle p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <Field label="Buscar por etiqueta">
                <Input
                  value={filter.tag ?? ''}
                  placeholder="p.ej. convocatoria"
                  onChange={(e) => set({ tag: e.target.value || undefined })}
                />
              </Field>
            </div>
            <Button onClick={() => setMore((v) => !v)} aria-expanded={more}>
              {more ? 'Menos filtros' : 'Más filtros'}
            </Button>
          </div>
          {more && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Field label="Categoría">
                <Select
                  empty="Todas"
                  value={filter.category_id ?? ''}
                  options={(catalogs.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  onChange={(e) => set({ category_id: Number(e.target.value) || undefined })}
                />
              </Field>
              <Field label="Relevancia">
                <Select
                  empty="Todas"
                  value={filter.relevance_level ?? ''}
                  options={(catalogs.data?.relevance_levels ?? []).map((r) => ({
                    value: r.code,
                    label: r.name,
                  }))}
                  onChange={(e) => set({ relevance_level: e.target.value || undefined })}
                />
              </Field>
              <Field label="Tipo de dependencia">
                <Select
                  empty="Cualquiera"
                  value={filter.scope_type ?? ''}
                  options={(catalogs.data?.scope_types ?? [])
                    .filter((s) => s.code !== 'institution')
                    .map((s) => ({ value: s.code, label: s.name }))}
                  onChange={(e) => set({ scope_type: e.target.value || undefined, scope_id: undefined })}
                />
              </Field>
              <Field label="Dependencia">
                <Select
                  empty="Todas"
                  value={filter.scope_id ?? ''}
                  disabled={!units[filter.scope_type ?? '']}
                  options={(units[filter.scope_type ?? ''] ?? []).map((u) => ({
                    value: u.id,
                    label: u.name,
                  }))}
                  onChange={(e) => set({ scope_id: Number(e.target.value) || undefined })}
                />
              </Field>
              <label className="flex h-10 items-center gap-2 self-end text-label-md text-on-surface">
                <input
                  type="checkbox"
                  checked={!!filter.featured}
                  onChange={(e) => set({ featured: e.target.checked || undefined })}
                />
                Solo destacadas
              </label>
            </div>
          )}
        </div>

        {news.isPending ? (
          <div className="p-6">
            <Loading />
          </div>
        ) : news.isError ? (
          <div className="p-6">
            <ErrorLine error={news.error} />
          </div>
        ) : !news.data.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Icon name="newspaper" className="text-[32px] text-neutral-muted" />
            <p className="text-body-md text-neutral-muted">
              No hay noticias aquí.{can('news.create') && ' Crea la primera con “Nueva noticia”.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {news.data.map((n) => {
              const image = responsiveImage(n.image_url, 320)?.src; // miniatura de 80 px
              const step = nextStep(n, can);
              return (
                <li key={n.id} className="flex items-center transition-colors hover:bg-canvas-cream">
                  <Link to={`${ROOT}/${n.id}`} className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3">
                    <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas-cream max-sm:h-12 max-sm:w-16">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Icon name="image" className="text-[24px] text-neutral-muted" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[n.status]}>{statusName(n.status)}</Badge>
                        {n.is_featured && <Badge tone="ok">Destacada</Badge>}
                        {n.is_pinned && <Badge>Fijada</Badge>}
                      </span>
                      <span className="line-clamp-2 text-body-md font-semibold text-on-surface sm:line-clamp-1">
                        {n.title}
                      </span>
                      <span className="truncate text-label-sm text-on-surface-variant">
                        {n.scopes.length
                          ? n.scopes.map((s) => scopeName(s.scope_type, s.scope_id)).join(' · ')
                          : 'Institucional'}
                        {' · '}actualizada {fmtDate(n.updated_at)}
                      </span>
                    </span>
                    {step && (
                      <span className="hidden shrink-0 items-center gap-1 text-label-md font-semibold text-secondary md:flex">
                        {step} <Icon name="arrow_forward" className="text-[18px]" />
                      </span>
                    )}
                  </Link>
                  {n.published_at && can('news.analytics') && (
                    <Link
                      to={`${ROOT}/${n.id}/estadisticas`}
                      aria-label={`Estadísticas de «${n.title}»`}
                      title="Estadísticas"
                      className="mr-3 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-label-md font-semibold text-secondary hover:bg-cta-sage"
                    >
                      <Icon name="insights" className="text-[20px]" />
                      <span className="max-lg:sr-only">Estadísticas</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <Button
            disabled={!filter.offset}
            onClick={() => setFilter((f) => ({ ...f, offset: Math.max(0, (f.offset ?? 0) - LIMIT) }))}
          >
            Anterior
          </Button>
          <Button
            disabled={(news.data?.length ?? 0) < LIMIT}
            onClick={() => setFilter((f) => ({ ...f, offset: (f.offset ?? 0) + LIMIT }))}
          >
            Siguiente
          </Button>
        </div>
      </section>

      <Drawer
        open={categories}
        onClose={() => setCategories(false)}
        title="Categorías"
        subtitle="Secciones en las que se agrupan las noticias del portal."
      >
        <Categories />
      </Drawer>
    </div>
  );
}

function Categories() {
  const catalogs = useCatalogs();
  const [name, setName] = useState('');
  const a = useAction([KEYS.catalogs]);
  return (
    <div>
      <ul className="mb-6 flex flex-wrap gap-2">
        {catalogs.data?.categories.map((c) => (
          <li key={c.id}>
            <Badge>{c.name}</Badge>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          await a.run(() => newsApi.createCategory(name.trim()), 'Categoría creada.');
          setName('');
        }}
      >
        <Field label="Nueva categoría">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={a.busy || name.trim().length < 2}>
          Crear
        </Button>
      </form>
      <div className="mt-2">
        <StatusLine status={a.status} />
      </div>
    </div>
  );
}
