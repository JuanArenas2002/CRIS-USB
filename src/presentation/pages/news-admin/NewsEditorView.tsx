import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import {
  htmlForBackend,
  htmlForBrowser,
  mediaUrl,
  newsApi,
  type News,
  type NewsInput,
  type NewsTemplate,
  type NewsScope,
} from '@/infrastructure/news/news-api';
import type { NewsPermissions } from '@/infrastructure/news/news-auth';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
import { RichTextEditor } from '@/presentation/components/admin/RichTextEditor';
import { PeopleCard } from './PeoplePicker';
import { NextStepCard } from './editor/NextStepCard';
import { EDITABLE_STATUSES } from './editor/next-step-model';
import { CategoryPicker } from './CategoryPicker';
import { LAYOUT_LABEL, MediaCard, TemplateThumb } from './MediaCard';
import { Icon } from '@/presentation/components/ui/Icon';
import { newsActionLabel } from './labels';
import { KEYS, useCatalogs, useOrg } from './queries';
import {
  Badge,
  Button,
  Card,
  ErrorLine,
  Field,
  Input,
  Loading,
  PageHeader,
  ROOT,
  STATUS_TONE,
  Select,
  StatusLine,
  TextArea,
  fmtDate,
  fromLocalInput,
  toLocalInput,
  useAction,
  useAdminSession,
} from './ui';

// Mismo criterio que el backend: tras la revisión solo se curan estos campos (con news.curate).
const FREE_FIELDS = new Set([
  'priority',
  'is_featured',
  'is_pinned',
  'relevance_level',
  'end_at',
  'tags',
  'scopes',
  'people',
  'category_ids',
  'template_id',
]);
const STEPS = [
  { code: 'draft', label: 'Borrador' },
  { code: 'in_review', label: 'En revisión' },
  { code: 'approved', label: 'Aprobada' },
  { code: 'published', label: 'Publicada' },
];
const STEP_OF: Record<string, number> = {
  draft: 0,
  rejected: 0,
  in_review: 1,
  approved: 2,
  scheduled: 3,
  published: 3,
  archived: 3,
};
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const MOD_KEY =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const EMPTY: NewsInput = {
  title: '',
  slug: null,
  summary: '',
  content: '',
  image_url: null,
  image_caption: null,
  category_id: 0,
  category_ids: [],
  template_id: null,
  media: [],
  relevance_level: 'medium',
  priority: 0,
  is_featured: false,
  is_pinned: false,
  start_at: null,
  end_at: null,
  tags: [],
  scopes: [],
  people: [],
};

const toInput = (n: News): NewsInput => ({
  title: n.title,
  slug: n.slug,
  summary: n.summary,
  content: n.content,
  image_url: n.image_url,
  image_caption: n.image_caption,
  category_id: n.category_id,
  // En el borrador solo las ADICIONALES: la principal la agrega el backend (y viene primero en la respuesta).
  category_ids: (n.category_ids ?? []).filter((id) => id !== n.category_id),
  template_id: n.template_id ?? null,
  media: (n.media ?? []).map((m) => ({
    kind: m.kind,
    url: m.url,
    title: m.title ?? null,
    caption: m.caption ?? null,
  })),
  relevance_level: n.relevance_level,
  priority: n.priority,
  is_featured: n.is_featured,
  is_pinned: n.is_pinned,
  start_at: n.start_at,
  end_at: n.end_at,
  tags: n.tags,
  scopes: n.scopes,
  people: n.people,
});

/** Solo lo que cambió: el backend rechaza tocar campos bloqueados aunque traigan el mismo valor. */
function changes(original: NewsInput, draft: NewsInput): Partial<NewsInput> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof NewsInput)[])
    if (JSON.stringify(original[key] ?? null) !== JSON.stringify(draft[key] ?? null)) out[key] = draft[key];
  return out as Partial<NewsInput>;
}

/** Qué falta para poder guardar (se explica en vez de dejar un botón deshabilitado sin motivo). */
function missing(d: NewsInput): string[] {
  return [
    !d.title.trim() && 'el título',
    !d.category_id && 'la categoría',
    !d.summary.trim() && 'el resumen',
    !d.content.replace(/<[^>]*>/g, '').trim() && !d.content.includes('<img') && 'el contenido',
  ].filter(Boolean) as string[];
}

export function NewsEditorView() {
  const { newsId } = useParams();
  // Solo ids numéricos: cualquier otra ruta (p. ej. una sección que este navegador aún no conoce) no debe
  // abrir un editor vacío. Antes `NaN` (falso) dejaba pasar /admin/noticias/plantillas como "nueva noticia".
  const valid = newsId === undefined || /^\d+$/.test(newsId);
  const id = newsId && valid ? Number(newsId) : undefined;
  const news = useQuery({ queryKey: [...KEYS.news, id], queryFn: () => newsApi.get(id!), enabled: !!id });
  if (!valid) return <Navigate to={ROOT} replace />;
  if (id && news.isPending) return <Loading />;
  if (id && news.isError) return <ErrorLine error={news.error} />;
  return <Editor key={news.data?.id ?? 'new'} news={news.data} />;
}

/** La única dependencia donde puede crear noticias, si no tiene permiso institucional ni otras. */
function onlyCreateScope(p: NewsPermissions): NewsScope[] {
  const grants = p.grants.filter((g) => g.permission === 'news.create');
  const g = grants[0];
  return grants.length === 1 && g?.scope_type && g.scope_type !== 'institution' && g.scope_id
    ? [{ scope_type: g.scope_type, scope_id: g.scope_id }]
    : [];
}

function Editor({ news }: { news?: News }) {
  const navigate = useNavigate();
  const { can, permissions } = useAdminSession();
  const catalogs = useCatalogs();
  const original = news ? toInput(news) : EMPTY;
  // Nueva: si solo puede crear en UNA dependencia (p. ej. rol "Centro de investigación"), ya viene marcada;
  // sin ella el backend la trataría como institucional y la rechazaría.
  const [draft, setDraft] = useState<NewsInput>(() =>
    news ? original : { ...EMPTY, scopes: onlyCreateScope(permissions) },
  );
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const set = (patch: Partial<NewsInput>) => setDraft((d) => ({ ...d, ...patch }));
  const save = useAction([KEYS.news]);
  const flow = useAction([KEYS.news]); // vive aquí: su mensaje sobrevive al cambio de etapa
  const locked = !!news && !EDITABLE_STATUSES.has(news.status);
  const lock = (field: keyof NewsInput) => locked && !FREE_FIELDS.has(field);
  const diff = changes(original, draft);
  const dirty = Object.keys(diff).length > 0;
  const todo = missing(draft);

  /** Guarda (crea o actualiza) y devuelve la noticia resultante, o undefined si falló. */
  const persist = async (ok: string): Promise<News | undefined> => {
    if (!news) {
      const created = (await save.run(async () => {
        const n = await newsApi.create(draft);
        return pendingImage ? newsApi.uploadImage(n.id, pendingImage) : n;
      }, ok)) as News | undefined;
      if (created) navigate(`${ROOT}/${created.id}`);
      return created;
    }
    if (!dirty) return news;
    return (await save.run(() => newsApi.update(news.id, diff), ok)) as News | undefined;
  };

  // Guardar sin volver arriba: barra fija cuando hay cambios + Ctrl/⌘+S. Mismas reglas que los botones de arriba.
  const editable = !news || EDITABLE_STATUSES.has(news.status);
  const canSave = !news ? can('news.create') : editable ? can('news.update') : can('news.curate');
  const missingToSave = editable ? todo : [];
  const saveNow = () => {
    if (dirty && canSave && !save.busy && !missingToSave.length)
      void persist(news ? 'Cambios guardados.' : 'Borrador creado.');
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); // nunca "Guardar página como…" del navegador
        saveNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  // Aviso del navegador al cerrar o recargar con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const [confirmDiscard, discardDialog] = useConfirm();
  const showBar = canSave && (dirty || save.status.kind === 'error');

  return (
    <div className={`flex flex-col gap-6 ${showBar ? 'pb-24' : ''}`}>
      {discardDialog}
      {showBar && (
        <div
          role="region"
          aria-label="Cambios sin guardar"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface-container-lowest/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:left-admin-sidebar"
        >
          <div className="flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0 text-body-sm text-on-surface">
              {save.status.kind === 'error' ? (
                <StatusLine status={save.status} />
              ) : missingToSave.length ? (
                <p>
                  <span className="font-semibold">Cambios sin guardar.</span> Para guardar falta:{' '}
                  {missingToSave.join(', ')}.
                </p>
              ) : (
                <p className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-secondary" />
                  <span className="font-semibold">Tienes cambios sin guardar.</span>
                  <span className="hidden text-neutral-muted sm:inline">
                    Atajo:{' '}
                    <kbd className="rounded border border-border-subtle bg-canvas-cream px-1.5 py-0.5 text-label-sm">
                      {MOD_KEY}
                    </kbd>{' '}
                    +{' '}
                    <kbd className="rounded border border-border-subtle bg-canvas-cream px-1.5 py-0.5 text-label-sm">
                      S
                    </kbd>
                  </span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {dirty && (
                <Button
                  disabled={save.busy}
                  onClick={async () => {
                    if (await confirmDiscard('¿Descartar los cambios sin guardar?', 'Descartar'))
                      setDraft(news ? original : { ...EMPTY, scopes: onlyCreateScope(permissions) });
                  }}
                >
                  Descartar
                </Button>
              )}
              <Button
                variant="primary"
                disabled={!dirty || save.busy || missingToSave.length > 0}
                onClick={saveNow}
                aria-keyshortcuts="Control+S Meta+S"
              >
                {save.busy ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <PageHeader
        crumbs={[{ label: 'Noticias', to: ROOT }]}
        title={news ? news.title : 'Nueva noticia'}
        description={
          news
            ? `Última actualización: ${fmtDate(news.updated_at)}`
            : 'Escribe la noticia y guárdala como borrador; después podrás enviarla a revisión.'
        }
      />

      <Stepper status={news?.status ?? 'draft'} />
      {news?.status === 'rejected' && <RejectionBanner id={news.id} />}

      {/* Edición a la izquierda; publicación y metadatos a la derecha (se apilan si no hay ancho). */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Contenido">
            {locked && (
              <p className="mb-4 rounded-lg bg-primary/10 p-3 text-label-sm text-primary">
                El contenido quedó bloqueado porque la noticia ya pasó la revisión. Aún puedes ajustar la
                prioridad, destacarla, la relevancia, el fin de vigencia, las etiquetas, las dependencias, las
                personas, las categorías adicionales y la plantilla de presentación.
              </p>
            )}
            <div className="flex flex-col gap-4">
              <Field label="Título *">
                <Input
                  value={draft.title}
                  disabled={lock('title')}
                  maxLength={250}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </Field>
              <Field label="Resumen *" hint="Una o dos frases: aparece en la portada y en los listados.">
                <TextArea
                  value={draft.summary}
                  disabled={lock('summary')}
                  onChange={(e) => set({ summary: e.target.value })}
                />
              </Field>
              {/* No va dentro de <label>: los clics de la barra irían al primer control. */}
              <div className="flex flex-col gap-1">
                <span id="news-content-label" className="text-label-md font-semibold text-on-surface">
                  Contenido *
                </span>
                <RichTextEditor
                  id="news-content"
                  labelledBy="news-content-label"
                  value={htmlForBrowser(draft.content)}
                  disabled={lock('content')}
                  onChange={(html) => set({ content: htmlForBackend(html) })}
                  onUploadImage={
                    news
                      ? async (file) =>
                          mediaUrl((await newsApi.uploadContentImage(news.id, file)).url) ?? undefined
                      : undefined
                  }
                  uploadHint="Guarda el borrador para poder insertar imágenes"
                />
                <span className="text-label-sm text-neutral-muted">
                  Usa el modo Visual o pega/escribe HTML. Por seguridad se eliminan scripts, iframes y estilos
                  en línea.
                </span>
              </div>
            </div>
          </Card>
          <MediaCard
            newsId={news?.id}
            media={draft.media}
            locked={lock('media')}
            onChange={(media) => set({ media })}
          />
          <ScopesCard scopes={draft.scopes} onChange={(scopes) => set({ scopes })} />
          <PeopleCard people={draft.people} onChange={(people) => set({ people })} />
          {news && <HistoryCard id={news.id} />}
        </div>

        <aside className="flex flex-col gap-6">
          <NextStepCard
            key={news?.status ?? 'new'} // al cambiar de etapa se reinician los formularios de rechazo/programación
            news={news}
            can={can}
            dirty={dirty}
            todo={todo}
            busy={save.busy}
            persist={persist}
            status={save.status}
            flow={flow}
          />
          <ImageCard
            news={news}
            locked={lock('image_url')}
            caption={draft.image_caption}
            onCaption={(image_caption) => set({ image_caption })}
            pending={pendingImage}
            onPending={setPendingImage}
            onRemove={() => set({ image_url: null })}
            imageUrl={draft.image_url}
          />
          <TemplatePicker
            templates={catalogs.data?.templates ?? []}
            value={draft.template_id}
            onChange={(template_id) => set({ template_id })}
          />
          <Card title="Clasificación">
            <div className="flex flex-col gap-3">
              <CategoryPicker
                categories={catalogs.data?.categories ?? []}
                principal={draft.category_id}
                extras={draft.category_ids}
                disabledPrincipal={lock('category_id')}
                onChange={(category_id, category_ids) => set({ category_id, category_ids })}
              />
              <Field label="Relevancia institucional">
                <Select
                  value={draft.relevance_level}
                  options={(catalogs.data?.relevance_levels ?? []).map((r) => ({
                    value: r.code,
                    label: r.name,
                  }))}
                  onChange={(e) => set({ relevance_level: e.target.value })}
                />
              </Field>
              <Field label="Prioridad" hint="Número mayor = aparece antes en la portada.">
                <Input
                  type="number"
                  value={draft.priority}
                  onChange={(e) => set({ priority: Number(e.target.value) || 0 })}
                />
              </Field>
              <label className="flex items-center gap-2 text-label-md text-on-surface">
                <input
                  type="checkbox"
                  checked={draft.is_featured}
                  onChange={(e) => set({ is_featured: e.target.checked })}
                />
                Destacada en la portada
              </label>
              <label className="flex items-center gap-2 text-label-md text-on-surface">
                <input
                  type="checkbox"
                  checked={draft.is_pinned}
                  onChange={(e) => set({ is_pinned: e.target.checked })}
                />
                Fijada arriba de los listados
              </label>
              <Field label="Etiquetas" hint="Separadas por comas">
                <Input
                  value={draft.tags.join(', ')}
                  onChange={(e) =>
                    set({
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>
          </Card>
          <Card title="Vigencia">
            <div className="flex flex-col gap-3">
              <Field label="Visible desde" hint="Vacío = desde que se publique">
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft.start_at)}
                  disabled={lock('start_at')}
                  onChange={(e) => set({ start_at: fromLocalInput(e.target.value) })}
                />
              </Field>
              <Field label="Visible hasta" hint="Vacío = sin fecha de fin">
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft.end_at)}
                  onChange={(e) => set({ end_at: fromLocalInput(e.target.value) })}
                />
              </Field>
              <Field label="Dirección (slug)" hint="Vacío = se genera desde el título">
                <Input
                  value={draft.slug ?? ''}
                  disabled={lock('slug')}
                  onChange={(e) => set({ slug: e.target.value || null })}
                />
              </Field>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stepper({ status }: { status: string }) {
  const current = STEP_OF[status] ?? 0;
  const note =
    status === 'scheduled'
      ? 'Programada'
      : status === 'archived'
        ? 'Archivada'
        : status === 'rejected'
          ? 'Rechazada'
          : null;
  return (
    <ol
      aria-label="Etapas de la noticia"
      className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-lowest p-4 border border-border-subtle"
    >
      {STEPS.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li
            key={step.code}
            className="flex items-center gap-2"
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-label-md font-bold ${
                state === 'done'
                  ? 'bg-secondary text-on-primary'
                  : state === 'current'
                    ? 'bg-primary text-on-primary'
                    : 'bg-canvas-cream text-neutral-muted'
              }`}
            >
              {state === 'done' ? <Icon name="check" className="text-[18px]" /> : i + 1}
            </span>
            <span
              className={`text-label-md ${state === 'todo' ? 'text-neutral-muted' : 'font-semibold text-on-surface'}`}
            >
              {step.label}
              {state === 'current' && note ? ` · ${note}` : ''}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-border-subtle" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function RejectionBanner({ id }: { id: number }) {
  const history = useQuery({ queryKey: [...KEYS.news, id, 'history'], queryFn: () => newsApi.history(id) });
  const last = [...(history.data ?? [])].reverse().find((h) => h.action === 'reject');
  return (
    <p role="alert" className="rounded-xl border border-error bg-error/10 p-4 text-body-sm text-error">
      <strong>La revisión pidió cambios.</strong> {last?.reason ? `Motivo: “${last.reason}”` : ''}
      {last?.actor_name ? ` — ${last.actor_name}` : ''}. Corrige y vuelve a enviarla.
    </p>
  );
}

function ImageCard({
  news,
  locked,
  imageUrl,
  caption,
  onCaption,
  pending,
  onPending,
  onRemove,
}: {
  news?: News;
  locked: boolean;
  imageUrl: string | null | undefined;
  caption: string | null | undefined;
  onCaption: (v: string | null) => void;
  pending: File | null;
  onPending: (f: File | null) => void;
  onRemove: () => void;
}) {
  const upload = useAction([KEYS.news]);
  const preview = useMemo(() => (pending ? URL.createObjectURL(pending) : null), [pending]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]); // libera la vista previa
  const shown = preview ?? mediaUrl(imageUrl);

  return (
    <Card title="Imagen principal">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-canvas-cream">
        {shown ? (
          <img src={shown} alt={caption ?? ''} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-label-sm text-neutral-muted">
            <Icon name="image" className="text-[32px]" /> Sin imagen
          </span>
        )}
      </div>
      {!locked && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg border border-border-subtle px-4 text-label-md font-semibold text-on-surface hover:bg-surface-cream-alt">
            <Icon name="upload" className="text-[18px]" /> {shown ? 'Cambiar imagen' : 'Subir imagen'}
            <input
              type="file"
              accept={IMAGE_TYPES}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (news) void upload.run(() => newsApi.uploadImage(news.id, file), 'Imagen actualizada.');
                else onPending(file); // se sube al crear el borrador
              }}
            />
          </label>
          {shown && <Button onClick={() => (pending ? onPending(null) : onRemove())}>Quitar</Button>}
        </div>
      )}
      <p className="mt-2 text-label-sm text-neutral-muted">
        JPG, PNG o WebP de hasta 5 MB, idealmente horizontal (16:9).
        {pending && !news ? ' Se subirá al crear el borrador.' : ''}
        {imageUrl === null && news?.image_url ? ' Guarda para confirmar que se quita.' : ''}
      </p>
      <div className="mt-3">
        <Field label="Pie de imagen">
          <Input
            value={caption ?? ''}
            disabled={locked}
            onChange={(e) => onCaption(e.target.value || null)}
          />
        </Field>
      </div>
      <div className="mt-2">
        <StatusLine status={upload.status} />
      </div>
    </Card>
  );
}

function ScopesCard({ scopes, onChange }: { scopes: NewsScope[]; onChange: (s: NewsScope[]) => void }) {
  const catalogs = useCatalogs();
  const { units, scopeName } = useOrg();
  const [type, setType] = useState('');
  const [unitId, setUnitId] = useState('');
  const typeUnits = units[type];
  const add = () => {
    const scope = { scope_type: type, scope_id: Number(unitId) };
    if (type && scope.scope_id && !scopes.some((s) => s.scope_type === type && s.scope_id === scope.scope_id))
      onChange([...scopes, scope]);
    setUnitId('');
  };
  return (
    <Card title="¿De qué dependencias es la noticia?">
      <p className="mb-3 text-label-sm text-neutral-muted">
        Déjalo vacío si es institucional. Solo puedes asociar dependencias donde tengas permiso.
      </p>
      <ul className="mb-4 flex flex-wrap gap-2">
        {scopes.map((s) => (
          <li
            key={`${s.scope_type}-${s.scope_id}`}
            className="flex items-center gap-1 rounded-full bg-canvas-cream py-1 pr-1 pl-3 text-label-sm"
          >
            {scopeName(s.scope_type, s.scope_id)}
            <button
              type="button"
              aria-label={`Quitar ${scopeName(s.scope_type, s.scope_id)}`}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-error/10 hover:text-error"
              onClick={() => onChange(scopes.filter((x) => x !== s))}
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </li>
        ))}
        {!scopes.length && (
          <li className="text-label-sm text-neutral-muted">Institucional (sin dependencia).</li>
        )}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Tipo">
          <Select
            empty="Elige"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setUnitId('');
            }}
            options={(catalogs.data?.scope_types ?? [])
              .filter((t) => t.code !== 'institution')
              .map((t) => ({ value: t.code, label: t.name }))}
          />
        </Field>
        {type && (
          <Field label="Dependencia">
            {typeUnits ? (
              <Select
                empty="Elige"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                options={typeUnits.map((u) => ({ value: u.id, label: u.name }))}
              />
            ) : (
              <Input
                type="number"
                min={1}
                placeholder="Código en Metri-K"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              />
            )}
          </Field>
        )}
        <Button onClick={add} disabled={!type || !unitId}>
          Agregar dependencia
        </Button>
      </div>
    </Card>
  );
}

function HistoryCard({ id }: { id: number }) {
  const catalogs = useCatalogs();
  const history = useQuery({ queryKey: [...KEYS.news, id, 'history'], queryFn: () => newsApi.history(id) });
  const statusName = (code: string | null) =>
    catalogs.data?.statuses.find((s) => s.code === code)?.name ?? code;
  return (
    <Card title="Historial">
      {history.isPending ? (
        <Loading />
      ) : history.isError ? (
        <ErrorLine error={history.error} />
      ) : (
        <ol className="flex flex-col gap-3 text-body-sm">
          {[...history.data].reverse().map((h, i) => (
            <li key={i} className="border-l-2 border-border-subtle pl-3">
              <p>
                <span className="font-semibold">{h.actor_name ?? 'Alguien'}</span>{' '}
                {newsActionLabel(h.action).toLowerCase()}
                {h.from_status !== h.to_status && (
                  <>
                    {' '}
                    · <Badge tone={STATUS_TONE[h.to_status]}>{statusName(h.to_status)}</Badge>
                  </>
                )}
              </p>
              <p className="text-label-sm text-neutral-muted">{fmtDate(h.at)}</p>
              {h.reason && <p className="mt-1 text-on-surface-variant">“{h.reason}”</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Plantilla de presentación de la noticia (la crean los administradores en "Plantillas"). */
function TemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: NewsTemplate[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  const { can } = useAdminSession();
  if (!templates.length) return null;
  const selected = value ?? templates.find((t) => t.is_default)?.id;
  return (
    <Card
      title="Presentación"
      description="Cómo se muestran la foto principal y el título en la página de la noticia."
      actions={
        can('news.manage_templates') ? (
          <Link
            to={`${ROOT}/plantillas`}
            className="text-label-sm font-semibold text-secondary hover:underline"
          >
            Administrar
          </Link>
        ) : undefined
      }
    >
      <div role="radiogroup" aria-label="Plantilla" className="grid grid-cols-2 gap-3">
        {templates.map((t) => {
          const active = t.id === selected;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={LAYOUT_LABEL[t.layout]}
              onClick={() => onChange(t.id)}
              className={`flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors ${
                active
                  ? 'border-secondary bg-cta-sage ring-1 ring-secondary'
                  : 'border-border-subtle hover:bg-surface-cream-alt'
              }`}
            >
              <TemplateThumb template={t} />
              <span className="text-label-sm leading-4 font-semibold text-on-surface">{t.name}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
