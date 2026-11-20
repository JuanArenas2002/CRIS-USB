import { useState } from 'react';
import { newsApi, type NewsTemplate, type TemplateInput } from '@/infrastructure/news/news-api';
import { useConfirm } from '@/presentation/components/admin/ConfirmDialog';
import { Drawer } from '@/presentation/components/admin/Drawer';
import { Icon } from '@/presentation/components/ui/Icon';
import { LAYOUT_LABEL, TemplateThumb } from './MediaCard';
import { KEYS, useCatalogs } from './queries';
import {
  Badge,
  Button,
  ErrorLine,
  Field,
  Input,
  Loading,
  PageHeader,
  Select,
  StatusLine,
  useAction,
  useAdminSession,
} from './ui';

const SIZE_LABEL: Record<NewsTemplate['image_size'], string> = {
  small: 'Pequeña',
  medium: 'Mediana',
  large: 'Grande',
  full: 'A todo lo ancho',
};
const TITLE_LABEL: Record<NewsTemplate['title_size'], string> = {
  md: 'Normal',
  lg: 'Grande',
  xl: 'Muy grande',
};
const RATIO_LABEL: Record<NewsTemplate['image_ratio'], string> = {
  '16:9': 'Panorámica (16:9)',
  '4:3': 'Clásica (4:3)',
  '3:2': 'Fotográfica (3:2)',
  '1:1': 'Cuadrada (1:1)',
  '21:9': 'Cine (21:9)',
};
const options = <K extends string>(labels: Record<K, string>) =>
  (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));
const EMPTY: TemplateInput = {
  name: '',
  layout: 'split',
  image_size: 'medium',
  image_ratio: '4:3',
  title_size: 'lg',
  is_default: false,
};

/** Plantillas de presentación de las noticias: disposición, foto y título. Exige news.manage_templates. */
export function TemplatesView() {
  const { can } = useAdminSession();
  const catalogs = useCatalogs();
  const [editing, setEditing] = useState<NewsTemplate | 'new' | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const remove = useAction([KEYS.catalogs]);
  if (!can('news.manage_templates'))
    return <ErrorLine error={new Error('Requiere el permiso news.manage_templates.')} />;
  const templates = catalogs.data?.templates ?? [];

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
      <PageHeader
        title="Plantillas de noticias"
        description="Definen cómo se ve el encabezado de una noticia: dónde va la foto principal, de qué tamaño y proporción, y qué tan grande es el título. Cada noticia elige una en el editor."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="add" className="text-[20px]" /> Nueva plantilla
            </span>
          </Button>
        }
      />
      <StatusLine status={remove.status} />
      {catalogs.isPending ? (
        <Loading />
      ) : catalogs.isError ? (
        <ErrorLine error={catalogs.error} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-container-lowest p-4"
            >
              <TemplateThumb template={t} />
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-title-md font-semibold text-on-surface">{t.name}</h2>
                {t.is_default && <Badge tone="ok">Predeterminada</Badge>}
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-label-sm">
                <dt className="text-neutral-muted">Disposición</dt>
                <dd className="text-on-surface">{LAYOUT_LABEL[t.layout]}</dd>
                <dt className="text-neutral-muted">Foto</dt>
                <dd className="text-on-surface">
                  {SIZE_LABEL[t.image_size]} · {t.image_ratio}
                </dd>
                <dt className="text-neutral-muted">Título</dt>
                <dd className="text-on-surface">{TITLE_LABEL[t.title_size]}</dd>
              </dl>
              <div className="mt-auto flex gap-2 border-t border-border-subtle pt-3">
                <Button onClick={() => setEditing(t)}>Editar</Button>
                {!t.is_default && (
                  <Button
                    variant="danger"
                    disabled={remove.busy}
                    onClick={async () => {
                      const msg = `¿Eliminar la plantilla «${t.name}»? Las noticias que la usan pasarán a la predeterminada.`;
                      if (await confirm(msg, 'Eliminar'))
                        void remove.run(() => newsApi.deleteTemplate(t.id), 'Plantilla eliminada.');
                    }}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nueva plantilla' : 'Editar plantilla'}
        subtitle="La vista previa muestra la disposición del encabezado."
      >
        {editing !== null && (
          <TemplateForm
            key={editing === 'new' ? 'new' : editing.id}
            template={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Drawer>
    </div>
  );
}

function TemplateForm({ template, onDone }: { template?: NewsTemplate; onDone: () => void }) {
  const [form, setForm] = useState<TemplateInput>(() => (template ? { ...template } : EMPTY));
  const a = useAction([KEYS.catalogs, KEYS.news]);
  const set = (patch: Partial<TemplateInput>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await a.run(
          () => (template ? newsApi.updateTemplate(template.id, form) : newsApi.createTemplate(form)),
          template ? 'Plantilla actualizada.' : 'Plantilla creada.',
        );
        if (ok) onDone();
      }}
    >
      <TemplateThumb template={form} className="max-w-sm" />
      <Field label="Nombre">
        <Input
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>
      <Field label="Disposición">
        <Select
          value={form.layout}
          options={options(LAYOUT_LABEL)}
          onChange={(e) => set({ layout: e.target.value as TemplateInput['layout'] })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tamaño de la foto">
          <Select
            value={form.image_size}
            options={options(SIZE_LABEL)}
            onChange={(e) => set({ image_size: e.target.value as TemplateInput['image_size'] })}
          />
        </Field>
        <Field label="Proporción de la foto">
          <Select
            value={form.image_ratio}
            options={options(RATIO_LABEL)}
            onChange={(e) => set({ image_ratio: e.target.value as TemplateInput['image_ratio'] })}
          />
        </Field>
      </div>
      <Field label="Tamaño del título">
        <Select
          value={form.title_size}
          options={options(TITLE_LABEL)}
          onChange={(e) => set({ title_size: e.target.value as TemplateInput['title_size'] })}
        />
      </Field>
      <label className="flex items-center gap-2 text-label-md text-on-surface">
        <input
          type="checkbox"
          checked={form.is_default}
          disabled={!!template?.is_default}
          onChange={(e) => set({ is_default: e.target.checked })}
        />
        Predeterminada (la usan las noticias que no eligen otra)
      </label>
      <StatusLine status={a.status} />
      <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
        <Button onClick={onDone}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={a.busy || form.name.trim().length < 2}>
          {template ? 'Guardar' : 'Crear plantilla'}
        </Button>
      </div>
    </form>
  );
}
